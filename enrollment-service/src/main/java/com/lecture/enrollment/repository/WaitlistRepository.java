package com.lecture.enrollment.repository;

import com.lecture.enrollment.entity.Waitlist;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface WaitlistRepository extends JpaRepository<Waitlist, Long> {

    List<Waitlist> findByUserId(Long userId);

    boolean existsByUserIdAndCourseId(Long userId, Long courseId);

    // 대기중(WAITING)인 것만 "이미 대기 등록됨"으로 취급 - MATCHED 이력은 무시
    boolean existsByUserIdAndCourseIdAndStatus(Long userId, Long courseId, Waitlist.Status status);

    // 취소로 자리가 났을 때 가장 먼저 등록한 대기자부터 매칭
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<Waitlist> findFirstByCourseIdAndStatusAndClaimedAtIsNullOrderByCreatedAtAsc(
            Long courseId, Waitlist.Status status);

    List<Waitlist> findByStatusAndClaimedAtLessThanEqual(
            Waitlist.Status status, LocalDateTime claimedAt);
}
