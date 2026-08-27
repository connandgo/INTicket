package com.lecture.enrollment.service;

import com.lecture.enrollment.entity.Enrollment;
import com.lecture.enrollment.entity.SeatHold;
import com.lecture.enrollment.repository.EnrollmentRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class EnrollmentWriteService {

    private final EnrollmentRepository enrollmentRepository;

    /**
     * 반드시 독립 트랜잭션으로 실행
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public Enrollment createPendingEnrollment(Long userId, SeatHold hold) {

        Enrollment enrollment = enrollmentRepository.save(
                Enrollment.builder()
                        .userId(userId)
                        .courseId(hold.getCourseId())
                        .holdId(hold.getId())
                        .scheduleId(hold.getScheduleId())
                        .grade(hold.getGrade())
                        .quantity(hold.getQuantity())
                        .unitPrice(hold.getUnitPrice())
                        .amount(hold.getAmount())
                        .build()
        );

        log.info("[EnrollmentWriteService] PENDING enrollment 생성 완료 - enrollmentId: {}, userId: {}, courseId: {}",
                enrollment.getId(), userId, hold.getCourseId());

        return enrollment;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public CancellationResult cancelEnrollment(Long userId, Long enrollmentId) {
        Enrollment enrollment = enrollmentRepository.findByIdForUpdate(enrollmentId)
                .orElseThrow(() -> new IllegalArgumentException("예매 정보를 찾을 수 없습니다: " + enrollmentId));

        if (!enrollment.getUserId().equals(userId)) {
            throw new org.springframework.security.access.AccessDeniedException("본인의 예매만 취소할 수 있습니다");
        }
        if (enrollment.getStatus() == Enrollment.Status.CANCELLED) {
            throw new IllegalArgumentException("이미 취소된 예매입니다");
        }

        boolean wasActive = enrollment.getStatus() == Enrollment.Status.ACTIVE;
        enrollment.cancel();
        return new CancellationResult(enrollment, wasActive);
    }

    public record CancellationResult(Enrollment enrollment, boolean wasActive) {}
}
