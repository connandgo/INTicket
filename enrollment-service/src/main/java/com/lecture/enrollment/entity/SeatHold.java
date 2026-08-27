package com.lecture.enrollment.entity;

import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "seat_holds", indexes = {
        @Index(name = "ix_hold_expiry_status", columnList = "status,expires_at"),
        @Index(name = "ix_hold_user_course", columnList = "user_id,course_id,status")
})
@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@EntityListeners(AuditingEntityListener.class)
public class SeatHold {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "course_id", nullable = false)
    private Long courseId;

    @Column(name = "schedule_id", nullable = false)
    private Long scheduleId;

    @Column(nullable = false, length = 10)
    private String grade;

    @Column(nullable = false)
    private Integer quantity;

    @Column(name = "unit_price", nullable = false, precision = 12, scale = 2)
    private BigDecimal unitPrice;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal amount;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private Status status = Status.HELD;

    @Column(name = "expires_at", nullable = false)
    private LocalDateTime expiresAt;

    @CreatedDate
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    public enum Status {
        HELD, CONFIRMED, RELEASED, EXPIRED
    }

    public boolean isExpired(LocalDateTime now) {
        return expiresAt.isBefore(now) || expiresAt.isEqual(now);
    }

    public void confirm() {
        if (status != Status.HELD) {
            throw new IllegalStateException("선점 상태가 아니므로 확정할 수 없습니다");
        }
        if (isExpired(LocalDateTime.now())) {
            throw new IllegalStateException("좌석 선점 시간이 만료되었습니다");
        }
        status = Status.CONFIRMED;
    }

    public void release() {
        if (status == Status.RELEASED || status == Status.EXPIRED) return;
        status = Status.RELEASED;
    }

    public void expire() {
        if (status == Status.HELD) status = Status.EXPIRED;
    }
}
