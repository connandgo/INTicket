package com.lecture.enrollment.dto;

import com.lecture.enrollment.entity.Enrollment;
import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.time.LocalDateTime;
import java.util.List;

public class EnrollmentDto {

    // 수강신청 요청
    @Getter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class EnrollRequest {
        @NotNull(message = "강의 ID는 필수입니다")
        private Long courseId;

        private Long holdId;
    }

    // 강의 요약 정보 (내 수강 목록 표시용)
    @Getter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class CourseSummary {
        private Long id;
        private String title;
        private String description;
        private String category;
        private Integer price;
        private String thumbnail;
        private String instructorName;
        private Integer enrollmentCount;
    }

    // 수강 응답
    @Getter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class EnrollmentResponse {
        private Long id;
        private Long userId;
        private Long courseId;
        private Enrollment.Status status;
        private LocalDateTime createdAt;

        // 추가
        private CourseSummary course;
        private BookingDto.BookingDetail booking;

        public static EnrollmentResponse from(Enrollment enrollment) {
            return EnrollmentResponse.builder()
                    .id(enrollment.getId())
                    .userId(enrollment.getUserId())
                    .courseId(enrollment.getCourseId())
                    .status(enrollment.getStatus())
                    .createdAt(enrollment.getCreatedAt())
                    .booking(toBookingDetail(enrollment))
                    .build();
        }

        public static EnrollmentResponse from(Enrollment enrollment, CourseSummary course) {
            return EnrollmentResponse.builder()
                    .id(enrollment.getId())
                    .userId(enrollment.getUserId())
                    .courseId(enrollment.getCourseId())
                    .status(enrollment.getStatus())
                    .createdAt(enrollment.getCreatedAt())
                    .course(course)
                    .booking(toBookingDetail(enrollment))
                    .build();
        }

        private static BookingDto.BookingDetail toBookingDetail(Enrollment enrollment) {
            if (enrollment.getScheduleId() == null) return null;
            return BookingDto.BookingDetail.builder()
                    .scheduleId(enrollment.getScheduleId())
                    .grade(enrollment.getGrade())
                    .quantity(enrollment.getQuantity())
                    .unitPrice(enrollment.getUnitPrice())
                    .amount(enrollment.getAmount())
                    .build();
        }
    }

    // 추천 서비스용: 수강 이력 조회 응답
    @Getter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class EnrollmentHistoryResponse {
        private Long userId;
        private List<Long> activeCourseIds;
    }

    // 공통 API 응답 래퍼
    @Getter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class ApiResponse<T> {
        private boolean success;
        private String message;
        private T data;

        public static <T> ApiResponse<T> success(T data) {
            return ApiResponse.<T>builder()
                    .success(true)
                    .message("성공")
                    .data(data)
                    .build();
        }

        public static <T> ApiResponse<T> error(String message) {
            return ApiResponse.<T>builder()
                    .success(false)
                    .message(message)
                    .build();
        }
    }
}
