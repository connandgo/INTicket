package com.lecture.enrollment.repository;

import com.lecture.enrollment.entity.Waitlist;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface WaitlistRepository extends JpaRepository<Waitlist, Long> {

    List<Waitlist> findByUserId(Long userId);

    boolean existsByUserIdAndCourseId(Long userId, Long courseId);

    // 취소로 자리가 났을 때 가장 먼저 등록한 대기자부터 매칭
    Optional<Waitlist> findFirstByCourseIdAndStatusOrderByCreatedAtAsc(
            Long courseId, Waitlist.Status status);
}
