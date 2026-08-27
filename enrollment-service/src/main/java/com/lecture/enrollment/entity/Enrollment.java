package com.lecture.enrollment.entity;

import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;

// user_id+course_id UNIQUE 제약을 DB에 걸어뒀었는데, 취소(CANCELLED) 후 같은 공연을
// 재예매하려 할 때도 막혀버리는 문제가 있어서 제거함. 중복예매 방지는 애플리케이션
// 레벨에서 status(PENDING/ACTIVE)만 체크하는 방식으로 대체함 (EnrollmentService 참고)
@Entity
@Table(name = "enrollments")
@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@EntityListeners(AuditingEntityListener.class)
public class Enrollment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "course_id", nullable = false)
    private Long courseId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private Status status = Status.PENDING;

    @CreatedDate
    @Column(updatable = false)
    private LocalDateTime createdAt;

    @LastModifiedDate
    private LocalDateTime updatedAt;

    public enum Status {
        PENDING,   // 수강신청 완료, 결제 대기
        ACTIVE,    // 결제 완료, 수강 활성화
        CANCELLED  // 취소
    }

    public void activate() {
        this.status = Status.ACTIVE;
    }

    public void cancel() {
        this.status = Status.CANCELLED;
    }
}
