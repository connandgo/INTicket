package com.lecture.enrollment.repository;

import com.lecture.enrollment.entity.SeatHold;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface SeatHoldRepository extends JpaRepository<SeatHold, Long> {
    List<SeatHold> findByStatusAndExpiresAtLessThanEqual(SeatHold.Status status, LocalDateTime expiresAt);

    Optional<SeatHold> findFirstByUserIdAndCourseIdAndScheduleIdAndGradeAndStatusOrderByCreatedAtDesc(
            Long userId, Long courseId, Long scheduleId, String grade, SeatHold.Status status);
}
