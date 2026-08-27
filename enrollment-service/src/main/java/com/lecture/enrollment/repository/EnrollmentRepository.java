package com.lecture.enrollment.repository;

import com.lecture.enrollment.entity.Enrollment;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface EnrollmentRepository extends JpaRepository<Enrollment, Long> {

    List<Enrollment> findByUserId(Long userId);

    List<Enrollment> findByUserIdAndStatus(Long userId, Enrollment.Status status);

    Optional<Enrollment> findByUserIdAndCourseId(Long userId, Long courseId);

    boolean existsByUserIdAndCourseId(Long userId, Long courseId);

    // 중복예매 방지용 - CANCELLED는 제외하고 PENDING/ACTIVE만 "이미 예매한 것"으로 취급
    boolean existsByUserIdAndCourseIdAndStatusIn(Long userId, Long courseId, List<Enrollment.Status> statuses);

    // 결제 완료 시 활성화할 대상 조회용 - CANCELLED 이력이 섞여있어도 PENDING/ACTIVE 중
    // 하나만 나오게(정상 흐름에서는 항상 최대 1건) 필터링
    Optional<Enrollment> findByUserIdAndCourseIdAndStatusIn(Long userId, Long courseId, List<Enrollment.Status> statuses);

    Optional<Enrollment> findByHoldId(Long holdId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select e from Enrollment e where e.id = :id")
    Optional<Enrollment> findByIdForUpdate(@Param("id") Long id);

    // 수강 완료(ACTIVE)된 강의 ID 목록 - 추천 서비스용
    List<Enrollment> findByUserIdAndStatusIn(Long userId, List<Enrollment.Status> statuses);
}
