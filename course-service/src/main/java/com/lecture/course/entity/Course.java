package com.lecture.course.entity;

import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "courses")
@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@EntityListeners(AuditingEntityListener.class)
public class Course {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Category category;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal price;

    // 강사 ID (users 테이블 참조 - 직접 JOIN 없이 ID만 보관)
    @Column(nullable = false)
    private Long instructorId;

    // 수강생 수 (추천 서비스 정렬 기준)
    @Column(nullable = false)
    @Builder.Default
    private Integer enrollmentCount = 0;

    // 정원 (null이면 무제한 - 기존에 등록된 강의와의 하위 호환을 위해 nullable)
    @Column
    private Integer capacity;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private Status status = Status.ACTIVE;

    @CreatedDate
    @Column(updatable = false)
    private LocalDateTime createdAt;

    @LastModifiedDate
    private LocalDateTime updatedAt;

    public enum Category {
        BACKEND, FRONTEND, DEVOPS, DATA_SCIENCE, MOBILE, SECURITY, DATABASE, OTHER
    }

    public enum Status {
        ACTIVE, INACTIVE
    }

    public void increaseEnrollmentCount(int quantity) {
        if (quantity < 1) {
            throw new IllegalArgumentException("예매 수량은 1 이상이어야 합니다");
        }
        this.enrollmentCount += quantity;
    }

    public void decreaseEnrollmentCount(int quantity) {
        if (quantity < 1) {
            throw new IllegalArgumentException("취소 수량은 1 이상이어야 합니다");
        }
        this.enrollmentCount = Math.max(0, this.enrollmentCount - quantity);
    }

    // capacity가 null이면 무제한이라 매진 자체가 없음
    public boolean isFull() {
        return capacity != null && enrollmentCount >= capacity;
    }
}
