package com.lecture.course.repository;

import com.lecture.course.entity.Course;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface CourseRepository extends JpaRepository<Course, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from Course c where c.id = :id")
    Optional<Course> findByIdForUpdate(@Param("id") Long id);

    // 카테고리별 강의 조회 (추천 서비스 사용)
    List<Course> findByCategoryAndStatus(Course.Category category, Course.Status status);

    // 강사별 강의 조회
    List<Course> findByInstructorId(Long instructorId);

    // 활성 강의 전체 조회
    List<Course> findByStatus(Course.Status status);

    // 카테고리별 + 특정 ID 제외 조회 (추천 서비스: 이미 수강한 강의 제외)
    List<Course> findByCategoryAndStatusAndIdNotIn(
            Course.Category category,
            Course.Status status,
            List<Long> excludeIds
    );
}
