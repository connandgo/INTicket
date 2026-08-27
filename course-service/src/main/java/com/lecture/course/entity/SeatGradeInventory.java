package com.lecture.course.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;

@Entity
@Table(name = "seat_grade_inventory", uniqueConstraints = {
        @UniqueConstraint(name = "uq_inventory_schedule_grade", columnNames = {"schedule_id", "grade"})
})
@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SeatGradeInventory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "schedule_id", nullable = false)
    private Long scheduleId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private Grade grade;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal price;

    @Column(nullable = false)
    private Integer capacity;

    @Column(nullable = false)
    @Builder.Default
    private Integer sold = 0;

    @Version
    private Long version;

    public enum Grade {
        VIP, R, S, A
    }

    public int remaining() {
        return Math.max(0, capacity - sold);
    }

    public void reserve(int quantity) {
        if (quantity < 1) {
            throw new IllegalArgumentException("좌석 수량은 1 이상이어야 합니다");
        }
        if (remaining() < quantity) {
            throw new IllegalArgumentException("잔여 좌석이 부족합니다");
        }
        sold += quantity;
    }

    public void release(int quantity) {
        if (quantity < 1) {
            throw new IllegalArgumentException("좌석 수량은 1 이상이어야 합니다");
        }
        sold = Math.max(0, sold - quantity);
    }
}
