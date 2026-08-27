package com.lecture.course.controller;

import com.lecture.course.dto.CourseDto;
import com.lecture.course.dto.PerformanceDto;
import com.lecture.course.entity.Course;
import com.lecture.course.service.CourseService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/courses")
@RequiredArgsConstructor
public class CourseController {

    private final CourseService courseService;
    private final com.lecture.course.service.PerformanceScheduleService performanceScheduleService;

    /**
     * POST /courses - 강의 등록 (강사만)
     * Gateway에서 전달한 X-User-Id 헤더로 강사 ID 추출
     */
    @PostMapping
    public ResponseEntity<CourseDto.ApiResponse<CourseDto.CourseResponse>> createCourse(
            @Valid @RequestBody CourseDto.CreateRequest request,
            @RequestHeader("X-User-Id") Long instructorId,
            @RequestHeader(value = "X-User-Role", required = false) String role) {

        // course-service SecurityConfig가 permitAll()이라 여기서 직접 검증 (Gateway가 이미 JWT 검증 후 넘겨준 헤더, INSTRUCTOR=공연기획사)
        if (!"INSTRUCTOR".equals(role)) {
            throw new AccessDeniedException("강의 등록은 INSTRUCTOR만 가능합니다");
        }

        CourseDto.CourseResponse response = courseService.createCourse(request, instructorId);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(CourseDto.ApiResponse.success(response));
    }

    /**
     * GET /courses - 전체 강의 목록
     */
    @GetMapping
    public ResponseEntity<CourseDto.ApiResponse<List<CourseDto.CourseResponse>>> getAllCourses() {
        return ResponseEntity.ok(
                CourseDto.ApiResponse.success(courseService.getAllCourses())
        );
    }

    /**
     * GET /courses/{id} - 강의 상세
     */
    @GetMapping("/{id}")
    public ResponseEntity<CourseDto.ApiResponse<CourseDto.CourseResponse>> getCourse(
            @PathVariable Long id) {
        return ResponseEntity.ok(
                CourseDto.ApiResponse.success(courseService.getCourse(id))
        );
    }

    /**
     * GET /courses/category/{category} - 카테고리별 강의
     */
    @GetMapping("/category/{category}")
    public ResponseEntity<CourseDto.ApiResponse<List<CourseDto.CourseResponse>>> getCoursesByCategory(
            @PathVariable Course.Category category) {
        return ResponseEntity.ok(
                CourseDto.ApiResponse.success(courseService.getCoursesByCategory(category))
        );
    }

    /**
     * GET /courses/internal/exists/{id} - 강의 존재 여부 (Enrollment Service 호출)
     */
    @GetMapping("/internal/exists/{id}")
    public ResponseEntity<Boolean> existsCourse(@PathVariable Long id) {
        return ResponseEntity.ok(courseService.existsCourse(id));
    }

    /**
     * GET /courses/internal/{id} - 강의 상세 조회 (Enrollment Service 내부 호출용)
     * - 내 수강 목록 응답 조립 시 사용
     * - 래퍼 없이 CourseResponse만 직접 반환
     */
    @GetMapping("/internal/{id}")
    public ResponseEntity<CourseDto.CourseResponse> getCourseInternal(@PathVariable Long id) {
        return ResponseEntity.ok(courseService.getCourse(id));
    }

    /**
     * POST /courses/internal/{id}/enrollment-count - 수강생 수 증가 (Enrollment Service 호출)
     */
    @PostMapping("/internal/{id}/enrollment-count")
    public ResponseEntity<Void> increaseEnrollmentCount(@PathVariable Long id) {
        courseService.increaseEnrollmentCount(id, 1);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/internal/{id}/enrollment-count/{quantity}")
    public ResponseEntity<Void> increaseEnrollmentCount(
            @PathVariable Long id, @PathVariable int quantity) {
        courseService.increaseEnrollmentCount(id, quantity);
        return ResponseEntity.ok().build();
    }

    /**
     * DELETE /courses/internal/{id}/enrollment-count - 수강생 수 감소 (Enrollment Service 예매 취소 시 호출)
     */
    @DeleteMapping("/internal/{id}/enrollment-count")
    public ResponseEntity<Void> decreaseEnrollmentCount(@PathVariable Long id) {
        courseService.decreaseEnrollmentCount(id, 1);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/internal/{id}/enrollment-count/{quantity}")
    public ResponseEntity<Void> decreaseEnrollmentCount(
            @PathVariable Long id, @PathVariable int quantity) {
        courseService.decreaseEnrollmentCount(id, quantity);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/{id}/schedules")
    public ResponseEntity<CourseDto.ApiResponse<List<PerformanceDto.ScheduleResponse>>> getSchedules(
            @PathVariable Long id) {
        return ResponseEntity.ok(CourseDto.ApiResponse.success(performanceScheduleService.getSchedules(id)));
    }

    @GetMapping("/{id}/schedules/{scheduleId}")
    public ResponseEntity<CourseDto.ApiResponse<PerformanceDto.ScheduleResponse>> getSchedule(
            @PathVariable Long id, @PathVariable Long scheduleId) {
        return ResponseEntity.ok(CourseDto.ApiResponse.success(performanceScheduleService.getSchedule(id, scheduleId)));
    }

    @PostMapping("/{id}/schedules")
    public ResponseEntity<CourseDto.ApiResponse<PerformanceDto.ScheduleResponse>> addSchedule(
            @PathVariable Long id,
            @RequestHeader("X-User-Id") Long instructorId,
            @RequestHeader(value = "X-User-Role", required = false) String role,
            @Valid @RequestBody PerformanceDto.CreateScheduleRequest request) {
        if (!"INSTRUCTOR".equals(role)) {
            throw new AccessDeniedException("공연기획사만 회차를 추가할 수 있습니다");
        }
        return ResponseEntity.status(HttpStatus.CREATED).body(CourseDto.ApiResponse.success(
                performanceScheduleService.addSchedule(id, instructorId, request)));
    }

    @GetMapping("/{id}/sales")
    public ResponseEntity<CourseDto.ApiResponse<List<PerformanceDto.SalesResponse>>> getSales(
            @PathVariable Long id) {
        return ResponseEntity.ok(CourseDto.ApiResponse.success(performanceScheduleService.getSales(id)));
    }

    @PostMapping("/internal/inventory/reserve")
    public ResponseEntity<PerformanceDto.InventoryResponse> reserveInventory(
            @Valid @RequestBody PerformanceDto.InventoryRequest request) {
        return ResponseEntity.ok(performanceScheduleService.reserve(request));
    }

    @PostMapping("/internal/inventory/release")
    public ResponseEntity<PerformanceDto.InventoryResponse> releaseInventory(
            @Valid @RequestBody PerformanceDto.InventoryRequest request) {
        return ResponseEntity.ok(performanceScheduleService.release(request));
    }

    @GetMapping("/internal/{id}/availability")
    public ResponseEntity<PerformanceDto.AvailabilityResponse> availability(@PathVariable Long id) {
        return ResponseEntity.ok(performanceScheduleService.firstAvailability(id));
    }

    /**
     * GET /courses/internal/recommend - 추천 서비스용 미수강 강의 조회
     * category: 카테고리, excludeIds: 이미 수강한 강의 ID 목록
     */
    @GetMapping("/internal/recommend")
    public ResponseEntity<List<CourseDto.CourseResponse>> getRecommendCourses(
            @RequestParam Course.Category category,
            @RequestParam(defaultValue = "") List<Long> excludeIds) {
        return ResponseEntity.ok(courseService.getRecommendCourses(category, excludeIds));
    }
}
