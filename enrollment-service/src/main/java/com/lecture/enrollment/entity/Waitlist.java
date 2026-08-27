package com.lecture.enrollment.entity;

import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;

// Enrollment랑 같은 이유로 UNIQUE 제약 안 씀 - MATCHED된 이력이 있어도
// 나중에 같은 공연에 다시 대기 등록할 수 있어야 함 (WaitlistService 참고)
@Entity
@Table(name = "waitlists")
@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@EntityListeners(AuditingEntityListener.class)
public class Waitlist {

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
    private Status status = Status.WAITING;

    @CreatedDate
    @Column(updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "claimed_at")
    private LocalDateTime claimedAt;

    public enum Status {
        WAITING,  // 대기 중
        MATCHED   // 자리 나서 자동 예매됨
    }

    public void match() {
        this.status = Status.MATCHED;
        this.claimedAt = null;
    }

    public void claim() {
        if (status != Status.WAITING || claimedAt != null) {
            throw new IllegalStateException("이미 처리 중이거나 완료된 대기 건입니다");
        }
        this.claimedAt = LocalDateTime.now();
    }

    public void releaseClaim() {
        if (status == Status.WAITING) this.claimedAt = null;
    }
}
