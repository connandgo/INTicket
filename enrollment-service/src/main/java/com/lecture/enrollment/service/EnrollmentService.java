package com.lecture.enrollment.service;

import com.lecture.enrollment.dto.EnrollmentDto;
import com.lecture.enrollment.entity.Enrollment;
import com.lecture.enrollment.kafka.EnrollmentKafkaProducer;
import com.lecture.enrollment.kafka.KafkaEvent;
import com.lecture.enrollment.repository.EnrollmentRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class EnrollmentService {

    private final EnrollmentRepository enrollmentRepository;
    private final CourseServiceClient courseServiceClient;
    private final PaymentServiceClient paymentServiceClient;
    private final EnrollmentKafkaProducer kafkaProducer;
    private final EnrollmentWriteService enrollmentWriteService;
    private final WaitlistService waitlistService;

    /**
     * 수강신청 전체 흐름
     * 1. 강의 존재 확인
     * 2. 중복 수강 확인
     * 3. Enrollment 생성 및 즉시 커밋 (PENDING)
     * 4. 결제 요청
     */
    public EnrollmentDto.EnrollmentResponse enroll(Long userId, Long courseId) {
        if (!courseServiceClient.existsCourse(courseId)) {
            throw new IllegalArgumentException("존재하지 않는 강의입니다: " + courseId);
        }

        // CANCELLED는 재예매 허용 - PENDING/ACTIVE인 것만 "이미 예매함"으로 취급
        if (enrollmentRepository.existsByUserIdAndCourseIdAndStatusIn(
                userId, courseId, List.of(Enrollment.Status.PENDING, Enrollment.Status.ACTIVE))) {
            throw new IllegalArgumentException("이미 수강신청한 강의입니다");
        }

        // 원래 99,000원으로 고정 하드코딩되어 있던 부분 - Course.price(공연 가격)를 그대로 결제 요청에 반영
        Map<String, Object> course = courseServiceClient.getCourse(courseId);

        if (isFull(course)) {
            throw new IllegalArgumentException("매진된 공연입니다. 취소표 대기 등록을 이용해 주세요");
        }

        Enrollment enrollment = enrollmentWriteService.createPendingEnrollment(userId, courseId);

        BigDecimal price = toBigDecimal(course.get("price"));
        paymentServiceClient.requestPayment(userId, courseId, price);

        log.info("[EnrollmentService] 수강신청 완료 (결제 대기) - enrollmentId: {}", enrollment.getId());
        return EnrollmentDto.EnrollmentResponse.from(enrollment);
    }

    /**
     * 수강 활성화
     */
    @Transactional
    public void activateEnrollment(Long userId, Long courseId) {
        // CANCELLED 이력이 섞여있을 수 있어서 PENDING/ACTIVE로 필터링해서 조회
        Enrollment enrollment = enrollmentRepository.findByUserIdAndCourseIdAndStatusIn(
                        userId, courseId, List.of(Enrollment.Status.PENDING, Enrollment.Status.ACTIVE))
                .orElseThrow(() -> new IllegalArgumentException(
                        "수강 정보를 찾을 수 없습니다 - userId: " + userId + ", courseId: " + courseId));

        // Kafka 중복 수신 시 enrollmentCount(누적 예매 수)·enrollment.completed 재발행 중복 방지
        if (enrollment.getStatus() == Enrollment.Status.ACTIVE) {
            log.info("[EnrollmentService] 이미 활성화된 수강입니다 (중복 이벤트 무시) - enrollmentId: {}", enrollment.getId());
            return;
        }

        enrollment.activate();

        courseServiceClient.increaseEnrollmentCount(courseId);

        kafkaProducer.publishEnrollmentCompleted(
                KafkaEvent.EnrollmentCompletedEvent.builder()
                        .enrollmentId(enrollment.getId())
                        .userId(userId)
                        .courseId(courseId)
                        .build()
        );

        log.info("[EnrollmentService] 수강 활성화 완료 - enrollmentId: {}", enrollment.getId());
    }

    /**
     * 예매 취소
     * - 본인 예매만 취소 가능
     * - ACTIVE였던 경우에만 수강생 수 감소(PENDING이었으면 애초에 증가된 적 없음)
     * - 결제도 함께 취소(모의 결제라 상태만 CANCELLED로 변경, 실제 환불 트랜잭션 없음)
     */
    @Transactional
    public void cancelEnrollment(Long userId, Long enrollmentId) {
        Enrollment enrollment = enrollmentRepository.findById(enrollmentId)
                .orElseThrow(() -> new IllegalArgumentException(
                        "예매 정보를 찾을 수 없습니다: " + enrollmentId));

        if (!enrollment.getUserId().equals(userId)) {
            throw new org.springframework.security.access.AccessDeniedException(
                    "본인의 예매만 취소할 수 있습니다");
        }

        if (enrollment.getStatus() == Enrollment.Status.CANCELLED) {
            throw new IllegalArgumentException("이미 취소된 예매입니다");
        }

        boolean wasActive = enrollment.getStatus() == Enrollment.Status.ACTIVE;

        enrollment.cancel();

        if (wasActive) {
            courseServiceClient.decreaseEnrollmentCount(enrollment.getCourseId());
            tryMatchWaitlist(enrollment.getCourseId());
        }

        paymentServiceClient.cancelPayment(userId, enrollment.getCourseId());

        log.info("[EnrollmentService] 예매 취소 완료 - enrollmentId: {}", enrollment.getId());
    }

    /**
     * 취소로 자리가 났을 때 가장 먼저 등록한 대기자를 자동으로 예매시킨다.
     * 매칭 실패해도 취소 자체는 이미 처리된 상태이므로 예외를 밖으로 던지지 않는다.
     */
    private void tryMatchWaitlist(Long courseId) {
        waitlistService.findNextWaiting(courseId).ifPresent(waiting -> {
            try {
                enroll(waiting.getUserId(), courseId);
                waitlistService.markMatched(waiting.getId());
                log.info("[EnrollmentService] 취소표 매칭 완료 - waitlistId: {}, userId: {}, courseId: {}",
                        waiting.getId(), waiting.getUserId(), courseId);
            } catch (Exception e) {
                log.error("[EnrollmentService] 취소표 매칭 실패 - waitlistId: {}, error: {}",
                        waiting.getId(), e.getMessage());
            }
        });
    }

    /**
     * 사용자 수강 목록 조회
     * - course-service에서 강의 상세 정보를 붙여서 반환
     */
    public List<EnrollmentDto.EnrollmentResponse> getEnrollmentsByUser(Long userId) {
        List<Enrollment> enrollments = enrollmentRepository.findByUserId(userId);

        return enrollments.stream()
                .map(enrollment -> {
                    Map<String, Object> courseInfo = courseServiceClient.getCourse(enrollment.getCourseId());

                    EnrollmentDto.CourseSummary courseSummary = EnrollmentDto.CourseSummary.builder()
                            .id(toLong(courseInfo.get("id")))
                            .title((String) courseInfo.get("title"))
                            .description((String) courseInfo.get("description"))
                            // 원본 normalizeCategory()는 여기서 category(장르)를 한글로 미리 바꿔 프론트 genre.js 매핑을 깨뜨려서 제거함 (아래 normalizeCategory 주석 참고)
                            .category((String) courseInfo.get("category"))
                            .price(toInteger(courseInfo.get("price")))
                            .thumbnail((String) courseInfo.get("thumbnail"))
                            .instructorName(
                                    firstNonNull(
                                            (String) courseInfo.get("instructorName"),
                                            (String) courseInfo.get("teacherName"),
                                            (String) courseInfo.get("instructor_name")
                                    )
                            )
                            .enrollmentCount(toInteger(
                                    firstNonNullObject(
                                            courseInfo.get("enrollmentCount"),
                                            courseInfo.get("enrollment_count")
                                    )
                            ))
                            .build();

                    return EnrollmentDto.EnrollmentResponse.from(enrollment, courseSummary);
                })
                .collect(Collectors.toList());
    }

    /**
     * 수강 이력 조회 - 추천 서비스용
     */
    public EnrollmentDto.EnrollmentHistoryResponse getEnrollmentHistory(Long userId) {
        List<Long> activeCourseIds = enrollmentRepository
                .findByUserIdAndStatus(userId, Enrollment.Status.ACTIVE)
                .stream()
                .map(Enrollment::getCourseId)
                .collect(Collectors.toList());

        return EnrollmentDto.EnrollmentHistoryResponse.builder()
                .userId(userId)
                .activeCourseIds(activeCourseIds)
                .build();
    }

    // private String normalizeCategory(String category) {
    //     if (category == null) return null;
    //     return switch (category) {
    //         case "BACKEND" -> "백엔드";
    //         case "FRONTEND" -> "프론트엔드";
    //         case "DEVOPS" -> "DevOps";
    //         case "DATA" -> "데이터";
    //         case "AI" -> "AI";
    //         default -> category;
    //     };
    // }

    private boolean isFull(Map<String, Object> course) {
        Object capacityValue = course.get("capacity");
        if (capacityValue == null) {
            return false; // 정원 무제한
        }
        int capacity = ((Number) capacityValue).intValue();
        int enrollmentCount = ((Number) course.get("enrollmentCount")).intValue();
        return enrollmentCount >= capacity;
    }

    private Long toLong(Object value) {
        if (value == null) return null;
        if (value instanceof Number number) return number.longValue();
        return Long.parseLong(value.toString());
    }

    private Integer toInteger(Object value) {
        if (value == null) return null;
        if (value instanceof Number number) return number.intValue();
        return Integer.parseInt(value.toString());
    }

    private BigDecimal toBigDecimal(Object value) {
        if (value == null) {
            throw new IllegalStateException("강의 가격 정보를 찾을 수 없습니다.");
        }
        if (value instanceof BigDecimal bigDecimal) return bigDecimal;
        if (value instanceof Number number) return BigDecimal.valueOf(number.doubleValue());
        return new BigDecimal(value.toString());
    }

    private String firstNonNull(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        return null;
    }

    private Object firstNonNullObject(Object... values) {
        for (Object value : values) {
            if (value != null) {
                return value;
            }
        }
        return null;
    }
}
