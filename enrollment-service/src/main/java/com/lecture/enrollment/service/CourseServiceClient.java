package com.lecture.enrollment.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.Map;
import java.math.BigDecimal;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Slf4j
@Component
@RequiredArgsConstructor
public class CourseServiceClient {

    private final WebClient.Builder webClientBuilder;

    @Value("${service.course-service.url}")
    private String courseServiceUrl;

    /**
     * Course Service: 강의 존재 여부 확인 (동기 REST)
     */
    public boolean existsCourse(Long courseId) {
        try {
            Boolean exists = webClientBuilder.build()
                    .get()
                    .uri(courseServiceUrl + "/api/courses/internal/exists/{id}", courseId)
                    .retrieve()
                    .bodyToMono(Boolean.class)
                    .block();

            return Boolean.TRUE.equals(exists);
        } catch (Exception e) {
            log.error("[CourseServiceClient] 강의 존재 확인 실패 - courseId: {}, error: {}",
                    courseId, e.getMessage());
            throw new RuntimeException("Course Service 연결 실패");
        }
    }

    /**
     * Course Service: 강의 상세 조회
     * - 내 수강 목록 응답에 course 정보를 붙일 때 사용
     * - course-service 쪽에 GET /api/courses/internal/{id} 엔드포인트가 있어야 함
     */
    public Map<String, Object> getCourse(Long courseId) {
        try {
            Map<String, Object> responseBody = webClientBuilder.build()
                    .get()
                    .uri(courseServiceUrl + "/api/courses/internal/{id}", courseId)
                    .retrieve()
                    .bodyToMono(new ParameterizedTypeReference<Map<String, Object>>() {})
                    .block();

            if (responseBody == null) {
                throw new RuntimeException("Course Service 응답 본문이 비어 있습니다.");
            }

            log.info("[CourseServiceClient] 강의 상세 조회 성공 - courseId: {}", courseId);
            log.debug("[CourseServiceClient] 강의 상세 응답 - courseId: {}, body: {}", courseId, responseBody);

            /*
             * 응답 형태가 다음 둘 중 하나일 수 있으므로 둘 다 처리
             *
             * 1) 래퍼 응답
             * {
             *   "success": true,
             *   "message": "성공",
             *   "data": { ...course fields... }
             * }
             *
             * 2) 바로 강의 객체 반환
             * {
             *   "id": 1,
             *   "title": "...",
             *   ...
             * }
             */
            Object data = responseBody.get("data");
            if (data instanceof Map<?, ?> dataMap) {
                @SuppressWarnings("unchecked")
                Map<String, Object> courseMap = (Map<String, Object>) dataMap;
                return courseMap;
            }

            return responseBody;
        } catch (Exception e) {
            log.error("[CourseServiceClient] 강의 상세 조회 실패 - courseId: {}, error: {}",
                    courseId, e.getMessage());
            throw new RuntimeException("Course Service 강의 상세 조회 실패");
        }
    }

    /**
     * Course Service: 수강생 수 증가 (수강 활성화 시 호출)
     */
    public void increaseEnrollmentCount(Long courseId, int quantity) {
        try {
            webClientBuilder.build()
                    .post()
                    .uri(courseServiceUrl + "/api/courses/internal/{id}/enrollment-count/{quantity}", courseId, quantity)
                    .retrieve()
                    .toBodilessEntity()
                    .block();

            log.info("[CourseServiceClient] 수강생 수 증가 완료 - courseId: {}", courseId);
        } catch (Exception e) {
            log.error("[CourseServiceClient] 수강생 수 증가 실패 - courseId: {}, error: {}",
                    courseId, e.getMessage());
            throw new RuntimeException("Course Service 예매 수량 반영 실패", e);
        }
    }

    /**
     * Course Service: 수강생 수 감소 (예매 취소 시 호출)
     */
    public void decreaseEnrollmentCount(Long courseId, int quantity) {
        try {
            webClientBuilder.build()
                    .method(org.springframework.http.HttpMethod.DELETE)
                    .uri(courseServiceUrl + "/api/courses/internal/{id}/enrollment-count/{quantity}", courseId, quantity)
                    .retrieve()
                    .toBodilessEntity()
                    .block();

            log.info("[CourseServiceClient] 수강생 수 감소 완료 - courseId: {}", courseId);
        } catch (Exception e) {
            log.error("[CourseServiceClient] 수강생 수 감소 실패 - courseId: {}, error: {}",
                    courseId, e.getMessage());
        }
    }

    public InventoryResult reserveInventory(Long courseId, Long scheduleId, String grade, Integer quantity) {
        return inventoryCall("/api/courses/internal/inventory/reserve",
                new InventoryRequest(courseId, scheduleId, grade, quantity));
    }

    public InventoryResult releaseInventory(Long courseId, Long scheduleId, String grade, Integer quantity) {
        return inventoryCall("/api/courses/internal/inventory/release",
                new InventoryRequest(courseId, scheduleId, grade, quantity));
    }

    public AvailabilityResult firstAvailability(Long courseId) {
        AvailabilityResult result = webClientBuilder.build()
                .get()
                .uri(courseServiceUrl + "/api/courses/internal/{id}/availability", courseId)
                .retrieve()
                .bodyToMono(AvailabilityResult.class)
                .block();
        if (result == null) throw new RuntimeException("Course Service 재고 응답이 비어 있습니다");
        return result;
    }

    private InventoryResult inventoryCall(String path, InventoryRequest request) {
        InventoryResult result = webClientBuilder.build()
                .post()
                .uri(courseServiceUrl + path)
                .bodyValue(request)
                .retrieve()
                .bodyToMono(InventoryResult.class)
                .block();
        if (result == null) throw new RuntimeException("Course Service 재고 응답이 비어 있습니다");
        return result;
    }

    private record InventoryRequest(Long courseId, Long scheduleId, String grade, Integer quantity) {}

    @Getter
    @NoArgsConstructor
    public static class InventoryResult {
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
    public static class AvailabilityResult {
        private Long courseId;
        private boolean available;
        private Long scheduleId;
        private String grade;
    }
}
