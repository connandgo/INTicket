package com.lecture.course.repository;

import com.lecture.course.entity.PerformanceSchedule;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PerformanceScheduleRepository extends JpaRepository<PerformanceSchedule, Long> {
    List<PerformanceSchedule> findByCourseIdAndStatusOrderByPerformanceDateAscPerformanceTimeAsc(
            Long courseId, PerformanceSchedule.Status status);

    Optional<PerformanceSchedule> findByIdAndCourseId(Long id, Long courseId);
}
