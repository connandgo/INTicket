package com.lecture.enrollment.dto;

import com.lecture.enrollment.entity.Waitlist;
import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.time.LocalDateTime;

public class WaitlistDto {

    // 취소표 대기 등록 요청
    @Getter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class WaitlistRequest {
        @NotNull(message = "강의 ID는 필수입니다")
        private Long courseId;
    }

    // 취소표 대기 응답
    @Getter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class WaitlistResponse {
        private Long id;
        private Long userId;
        private Long courseId;
        private Waitlist.Status status;
        private LocalDateTime createdAt;

        public static WaitlistResponse from(Waitlist waitlist) {
            return WaitlistResponse.builder()
                    .id(waitlist.getId())
                    .userId(waitlist.getUserId())
                    .courseId(waitlist.getCourseId())
                    .status(waitlist.getStatus())
                    .createdAt(waitlist.getCreatedAt())
                    .build();
        }
    }
}
