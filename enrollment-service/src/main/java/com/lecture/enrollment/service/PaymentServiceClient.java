package com.lecture.enrollment.service;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;

import java.math.BigDecimal;

@Slf4j
@Component
@RequiredArgsConstructor
public class PaymentServiceClient {

    private final WebClient.Builder webClientBuilder;

    @Value("${service.payment-service.url}")
    private String paymentServiceUrl;

    /**
     * Payment Service: 결제 요청 (동기 REST)
     */
    public PaymentResult requestPayment(Long enrollmentId, Long userId, Long courseId,
                                        BigDecimal amount, Integer quantity) {
        try {
            PaymentRequest request = new PaymentRequest(enrollmentId, userId, courseId, amount, quantity);

            PaymentResult result = webClientBuilder.build()
                    .post()
                    .uri(paymentServiceUrl + "/api/payments/internal/request")
                    .bodyValue(request)
                    .retrieve()
                    .bodyToMono(PaymentResult.class)
                    .block();

            log.info("[PaymentServiceClient] 결제 요청 완료 - userId: {}, courseId: {}, result: {}",
                    userId, courseId, result != null ? result.getStatus() : "null");

            return result;
        } catch (Exception e) {
            log.error("[PaymentServiceClient] 결제 요청 실패 - userId: {}, courseId: {}, error: {}",
                    userId, courseId, e.getMessage(), e);
            throw new RuntimeException("Payment Service 연결 실패");
        }
    }

    /**
     * Payment Service: 결제 취소 요청 (동기 REST)
     */
    public void cancelPayment(Long enrollmentId) {
        try {
            webClientBuilder.build()
                    .post()
                    .uri(paymentServiceUrl + "/api/payments/internal/cancel")
                    .bodyValue(new CancelRequest(enrollmentId))
                    .retrieve()
                    .toBodilessEntity()
                    .block();

            log.info("[PaymentServiceClient] 결제 취소 완료 - enrollmentId: {}", enrollmentId);
        } catch (Exception e) {
            log.error("[PaymentServiceClient] 결제 취소 실패 - enrollmentId: {}, error: {}",
                    enrollmentId, e.getMessage());
        }
    }

    @Getter
    @NoArgsConstructor
    static class CancelRequest {
        private Long enrollmentId;

        CancelRequest(Long enrollmentId) {
            this.enrollmentId = enrollmentId;
        }
    }

    @Getter
    @NoArgsConstructor
    static class PaymentRequest {
        private Long enrollmentId;
        private Long userId;
        private Long courseId;
        private BigDecimal amount;
        private Integer quantity;

        PaymentRequest(Long enrollmentId, Long userId, Long courseId, BigDecimal amount, Integer quantity) {
            this.enrollmentId = enrollmentId;
            this.userId = userId;
            this.courseId = courseId;
            this.amount = amount;
            this.quantity = quantity;
        }
    }

    @Getter
    @NoArgsConstructor
    public static class PaymentResult {
        private Long paymentId;
        private String status; // COMPLETED / FAILED
    }
}
