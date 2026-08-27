package com.lecture.enrollment.dto;

import com.lecture.enrollment.entity.SeatHold;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public class BookingDto {

    @Getter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class HoldRequest {
        private Long holdId;
        @NotNull private Long performanceId;
        @NotNull private Long scheduleId;
        @NotBlank private String grade;
        @NotNull @Positive @Max(4) private Integer quantity;
    }

    @Getter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class HoldResponse {
        private Long holdId;
        private Long performanceId;
        private Long scheduleId;
        private String grade;
        private Integer quantity;
        private BigDecimal unitPrice;
        private BigDecimal amount;
        private Integer remaining;
        private LocalDateTime expiresAt;

        public static HoldResponse from(SeatHold hold, Integer remaining) {
            return HoldResponse.builder()
                    .holdId(hold.getId())
                    .performanceId(hold.getCourseId())
                    .scheduleId(hold.getScheduleId())
                    .grade(hold.getGrade())
                    .quantity(hold.getQuantity())
                    .unitPrice(hold.getUnitPrice())
                    .amount(hold.getAmount())
                    .remaining(remaining)
                    .expiresAt(hold.getExpiresAt())
                    .build();
        }
    }

    @Getter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class BookingDetail {
        private Long scheduleId;
        private String grade;
        private Integer quantity;
        private BigDecimal unitPrice;
        private BigDecimal amount;
    }
}
