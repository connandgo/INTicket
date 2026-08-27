package com.lecture.enrollment.service;

import com.lecture.enrollment.dto.BookingDto;
import com.lecture.enrollment.entity.SeatHold;
import com.lecture.enrollment.repository.SeatHoldRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class BookingService {

    private final SeatHoldRepository holdRepository;
    private final CourseServiceClient courseServiceClient;

    @Transactional
    public BookingDto.HoldResponse hold(Long userId, BookingDto.HoldRequest request) {
        CourseServiceClient.InventoryResult inventory = courseServiceClient.reserveInventory(
                request.getPerformanceId(), request.getScheduleId(), request.getGrade(), request.getQuantity());
        try {
            SeatHold saved = holdRepository.save(SeatHold.builder()
                    .userId(userId)
                    .courseId(request.getPerformanceId())
                    .scheduleId(request.getScheduleId())
                    .grade(inventory.getGrade())
                    .quantity(request.getQuantity())
                    .unitPrice(inventory.getUnitPrice())
                    .amount(inventory.getAmount())
                    .expiresAt(LocalDateTime.now().plusMinutes(10))
                    .build());
            return BookingDto.HoldResponse.from(saved, inventory.getRemaining());
        } catch (RuntimeException e) {
            courseServiceClient.releaseInventory(
                    request.getPerformanceId(), request.getScheduleId(), request.getGrade(), request.getQuantity());
            throw e;
        }
    }

    @Transactional(readOnly = true)
    public SeatHold requireUsableHold(Long holdId, Long userId, Long courseId) {
        SeatHold hold = holdRepository.findById(holdId)
                .orElseThrow(() -> new IllegalArgumentException("좌석 선점 정보를 찾을 수 없습니다: " + holdId));
        if (!hold.getUserId().equals(userId) || !hold.getCourseId().equals(courseId)) {
            throw new org.springframework.security.access.AccessDeniedException("본인의 좌석 선점만 사용할 수 있습니다");
        }
        if (hold.getStatus() != SeatHold.Status.HELD || hold.isExpired(LocalDateTime.now())) {
            throw new IllegalArgumentException("좌석 선점 시간이 만료되었거나 사용할 수 없습니다");
        }
        return hold;
    }

    @Transactional
    public void confirm(Long holdId) {
        SeatHold hold = holdRepository.findById(holdId)
                .orElseThrow(() -> new IllegalArgumentException("좌석 선점 정보를 찾을 수 없습니다: " + holdId));
        if (hold.getStatus() == SeatHold.Status.CONFIRMED) return;
        hold.confirm();
    }

    @Transactional
    public void release(Long userId, BookingDto.HoldRequest request) {
        if (request.getHoldId() != null) {
            SeatHold hold = holdRepository.findById(request.getHoldId())
                    .orElseThrow(() -> new IllegalArgumentException(
                            "좌석 선점 정보를 찾을 수 없습니다: " + request.getHoldId()));
            if (!hold.getUserId().equals(userId)) {
                throw new org.springframework.security.access.AccessDeniedException("본인의 좌석 선점만 해제할 수 있습니다");
            }
            releaseInventory(hold);
            return;
        }
        holdRepository.findFirstByUserIdAndCourseIdAndScheduleIdAndGradeAndStatusOrderByCreatedAtDesc(
                        userId, request.getPerformanceId(), request.getScheduleId(),
                        request.getGrade(), SeatHold.Status.HELD)
                .ifPresent(this::releaseInventory);
    }

    @Transactional
    public void releaseConfirmed(Long holdId) {
        holdRepository.findById(holdId).ifPresent(this::releaseInventory);
    }

    @Scheduled(fixedDelay = 15000)
    @Transactional
    public void releaseExpiredHolds() {
        List<SeatHold> expired = holdRepository.findByStatusAndExpiresAtLessThanEqual(
                SeatHold.Status.HELD, LocalDateTime.now());
        expired.forEach(hold -> {
            courseServiceClient.releaseInventory(
                    hold.getCourseId(), hold.getScheduleId(), hold.getGrade(), hold.getQuantity());
            hold.expire();
            log.info("[BookingService] 좌석 선점 만료 - holdId: {}", hold.getId());
        });
    }

    private void releaseInventory(SeatHold hold) {
        if (hold.getStatus() == SeatHold.Status.RELEASED || hold.getStatus() == SeatHold.Status.EXPIRED) return;
        courseServiceClient.releaseInventory(
                hold.getCourseId(), hold.getScheduleId(), hold.getGrade(), hold.getQuantity());
        hold.release();
    }
}
