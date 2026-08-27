package com.lecture.course.dto;

import com.lecture.course.entity.PerformanceSchedule;
import com.lecture.course.entity.SeatGradeInventory;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

public class PerformanceDto {

    @Getter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class GradeResponse {
        private String grade;
        private BigDecimal price;
        private Integer capacity;
        private Integer sold;

        public static GradeResponse from(SeatGradeInventory inventory) {
            return GradeResponse.builder()
                    .grade(inventory.getGrade().name())
                    .price(inventory.getPrice())
                    .capacity(inventory.getCapacity())
                    .sold(inventory.getSold())
                    .build();
        }
    }

    @Getter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class ScheduleResponse {
        private Long id;
        private LocalDate date;
        private String weekday;
        private LocalTime time;
        private List<GradeResponse> grades;

        public static ScheduleResponse from(PerformanceSchedule schedule, List<SeatGradeInventory> inventories) {
            return ScheduleResponse.builder()
                    .id(schedule.getId())
                    .date(schedule.getPerformanceDate())
                    .weekday(switch (schedule.getPerformanceDate().getDayOfWeek()) {
                        case MONDAY -> "월";
                        case TUESDAY -> "화";
                        case WEDNESDAY -> "수";
                        case THURSDAY -> "목";
                        case FRIDAY -> "금";
                        case SATURDAY -> "토";
                        case SUNDAY -> "일";
                    })
                    .time(schedule.getPerformanceTime())
                    .grades(inventories.stream().map(GradeResponse::from).toList())
                    .build();
        }
    }

    @Getter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class SalesResponse {
        private Long id;
        private LocalDate date;
        private String weekday;
        private LocalTime time;
        private Integer capacity;
        private Integer sold;
        private Integer rate;
    }

    @Getter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class GradeRequest {
        @NotBlank
        private String grade;
        @NotNull
        @Positive
        private BigDecimal price;
        @NotNull
        @Positive
        private Integer capacity;
    }

    @Getter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class CreateScheduleRequest {
        @NotNull
        private LocalDate date;
        @NotNull
        private LocalTime time;
        @Valid
        private List<GradeRequest> grades;
    }

    @Getter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class InventoryRequest {
        @NotNull
        private Long courseId;
        @NotNull
        private Long scheduleId;
        @NotBlank
        private String grade;
        @NotNull
        @Positive
        private Integer quantity;
    }

    @Getter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class InventoryResponse {
        private Long courseId;
        private Long scheduleId;
        private String grade;
        private Integer quantity;
        private BigDecimal unitPrice;
        private BigDecimal amount;
        private Integer remaining;
    }

    @Getter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class AvailabilityResponse {
        private Long courseId;
        private boolean available;
        private Long scheduleId;
        private String grade;
    }
}
