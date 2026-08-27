package com.lecture.course.repository;

import com.lecture.course.entity.SeatGradeInventory;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface SeatGradeInventoryRepository extends JpaRepository<SeatGradeInventory, Long> {
    List<SeatGradeInventory> findByScheduleIdOrderById(Long scheduleId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select i from SeatGradeInventory i where i.scheduleId = :scheduleId and i.grade = :grade")
    Optional<SeatGradeInventory> findForUpdate(
            @Param("scheduleId") Long scheduleId,
            @Param("grade") SeatGradeInventory.Grade grade);
}
