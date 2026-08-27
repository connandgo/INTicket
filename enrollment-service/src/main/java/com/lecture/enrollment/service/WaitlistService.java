package com.lecture.enrollment.service;

import com.lecture.enrollment.dto.WaitlistDto;
import com.lecture.enrollment.entity.Waitlist;
import com.lecture.enrollment.repository.EnrollmentRepository;
import com.lecture.enrollment.repository.WaitlistRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * 취소표 대기 등록/조회만 담당한다.
 * 매칭 성사 시 실제 예매 생성은 EnrollmentService.enroll()이 처리한다
 * (여기서 EnrollmentService를 직접 참조하면 순환 의존이 생기므로,
 * "다음 대기자 찾기"까지만 하고 예매 생성은 호출하는 쪽에 맡긴다).
 */
@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class WaitlistService {

    private final WaitlistRepository waitlistRepository;
    private final EnrollmentRepository enrollmentRepository;
    private final CourseServiceClient courseServiceClient;

    @Transactional
    public WaitlistDto.WaitlistResponse register(Long userId, Long courseId) {
        if (!courseServiceClient.existsCourse(courseId)) {
            throw new IllegalArgumentException("존재하지 않는 강의입니다: " + courseId);
        }

        if (enrollmentRepository.existsByUserIdAndCourseId(userId, courseId)) {
            throw new IllegalArgumentException("이미 예매한 공연입니다");
        }

        if (waitlistRepository.existsByUserIdAndCourseId(userId, courseId)) {
            throw new IllegalArgumentException("이미 취소표 대기 등록된 공연입니다");
        }

        Map<String, Object> course = courseServiceClient.getCourse(courseId);
        if (!isFull(course)) {
            throw new IllegalArgumentException("매진되지 않은 공연입니다. 바로 예매해 주세요");
        }

        Waitlist waitlist = waitlistRepository.save(
                Waitlist.builder()
                        .userId(userId)
                        .courseId(courseId)
                        .build()
        );

        log.info("[WaitlistService] 취소표 대기 등록 완료 - waitlistId: {}, userId: {}, courseId: {}",
                waitlist.getId(), userId, courseId);

        return WaitlistDto.WaitlistResponse.from(waitlist);
    }

    public List<WaitlistDto.WaitlistResponse> getMyWaitlist(Long userId) {
        return waitlistRepository.findByUserId(userId).stream()
                .map(WaitlistDto.WaitlistResponse::from)
                .collect(Collectors.toList());
    }

    /**
     * 취소로 자리가 났을 때, 가장 먼저 등록한 대기자를 찾는다.
     * 실제 예매 생성/매칭 확정 처리는 호출한 쪽(EnrollmentService)이 한다.
     */
    public Optional<Waitlist> findNextWaiting(Long courseId) {
        return waitlistRepository.findFirstByCourseIdAndStatusOrderByCreatedAtAsc(
                courseId, Waitlist.Status.WAITING);
    }

    @Transactional
    public void markMatched(Long waitlistId) {
        waitlistRepository.findById(waitlistId).ifPresent(Waitlist::match);
    }

    private boolean isFull(Map<String, Object> course) {
        Object capacityValue = course.get("capacity");
        if (capacityValue == null) {
            return false; // 정원 무제한
        }
        int capacity = ((Number) capacityValue).intValue();
        int enrollmentCount = ((Number) course.get("enrollmentCount")).intValue();
        return enrollmentCount >= capacity;
    }
}
