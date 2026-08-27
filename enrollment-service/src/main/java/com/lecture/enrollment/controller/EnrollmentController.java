package com.lecture.enrollment.controller;

import com.lecture.enrollment.dto.EnrollmentDto;
import com.lecture.enrollment.dto.WaitlistDto;
import com.lecture.enrollment.service.EnrollmentService;
import com.lecture.enrollment.service.WaitlistService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/enrollments")
@RequiredArgsConstructor
public class EnrollmentController {

    private final EnrollmentService enrollmentService;
    private final WaitlistService waitlistService;

    /**
     * POST /enrollments - 수강신청
     * Gateway에서 X-User-Id 헤더로 사용자 ID 전달
     */
    @PostMapping
    public ResponseEntity<EnrollmentDto.ApiResponse<EnrollmentDto.EnrollmentResponse>> enroll(
            @Valid @RequestBody EnrollmentDto.EnrollRequest request,
            @RequestHeader("X-User-Id") Long userId) {

        EnrollmentDto.EnrollmentResponse response =
                enrollmentService.enroll(userId, request.getCourseId());
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(EnrollmentDto.ApiResponse.success(response));
    }

    /**
     * GET /enrollments/my - 내 수강 목록 조회
     * Gateway가 전달한 X-User-Id 헤더를 사용
     */
    @GetMapping("/my")
    public ResponseEntity<EnrollmentDto.ApiResponse<List<EnrollmentDto.EnrollmentResponse>>> getMyEnrollments(
            @RequestHeader("X-User-Id") Long userId) {

        List<EnrollmentDto.EnrollmentResponse> response =
                enrollmentService.getEnrollmentsByUser(userId);
        return ResponseEntity.ok(EnrollmentDto.ApiResponse.success(response));
    }

    /**
     * DELETE /enrollments/{id} - 예매 취소
     * Gateway에서 X-User-Id 헤더로 사용자 ID 전달, 본인 예매만 취소 가능
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<EnrollmentDto.ApiResponse<Void>> cancelEnrollment(
            @PathVariable Long id,
            @RequestHeader("X-User-Id") Long userId) {

        enrollmentService.cancelEnrollment(userId, id);
        return ResponseEntity.ok(EnrollmentDto.ApiResponse.<Void>success(null));
    }

    /**
     * GET /enrollments/user/{userId} - 특정 사용자 수강 목록 조회
     */
    @GetMapping("/user/{userId}")
    public ResponseEntity<EnrollmentDto.ApiResponse<List<EnrollmentDto.EnrollmentResponse>>> getEnrollments(
            @PathVariable Long userId) {

        List<EnrollmentDto.EnrollmentResponse> response =
                enrollmentService.getEnrollmentsByUser(userId);
        return ResponseEntity.ok(EnrollmentDto.ApiResponse.success(response));
    }

    /**
     * POST /enrollments/waitlist - 취소표 대기 등록
     * 매진된 공연에만 등록 가능. 자리가 나면 등록 순서대로 자동 예매됨
     */
    @PostMapping("/waitlist")
    public ResponseEntity<EnrollmentDto.ApiResponse<WaitlistDto.WaitlistResponse>> registerWaitlist(
            @Valid @RequestBody WaitlistDto.WaitlistRequest request,
            @RequestHeader("X-User-Id") Long userId) {

        WaitlistDto.WaitlistResponse response = waitlistService.register(userId, request.getCourseId());
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(EnrollmentDto.ApiResponse.success(response));
    }

    /**
     * GET /enrollments/waitlist/my - 내 취소표 대기 목록 조회
     * 실시간 알림 없음 - 재조회해서 status가 MATCHED로 바뀌었는지 확인하는 방식
     */
    @GetMapping("/waitlist/my")
    public ResponseEntity<EnrollmentDto.ApiResponse<List<WaitlistDto.WaitlistResponse>>> getMyWaitlist(
            @RequestHeader("X-User-Id") Long userId) {

        List<WaitlistDto.WaitlistResponse> response = waitlistService.getMyWaitlist(userId);
        return ResponseEntity.ok(EnrollmentDto.ApiResponse.success(response));
    }

    /**
     * GET /enrollments/internal/history/{userId} - 수강 이력 조회 (Recommend Service용)
     */
    @GetMapping("/internal/history/{userId}")
    public ResponseEntity<EnrollmentDto.EnrollmentHistoryResponse> getEnrollmentHistory(
            @PathVariable Long userId) {

        return ResponseEntity.ok(enrollmentService.getEnrollmentHistory(userId));
    }
}