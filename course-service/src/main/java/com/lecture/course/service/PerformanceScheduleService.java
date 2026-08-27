package com.lecture.course.service;

import com.lecture.course.dto.PerformanceDto;
import com.lecture.course.entity.Course;
import com.lecture.course.entity.PerformanceSchedule;
import com.lecture.course.entity.SeatGradeInventory;
import com.lecture.course.repository.CourseRepository;
import com.lecture.course.repository.PerformanceScheduleRepository;
import com.lecture.course.repository.SeatGradeInventoryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class PerformanceScheduleService {

    private static final List<SeatGradeInventory.Grade> GRADES = List.of(
            SeatGradeInventory.Grade.VIP,
            SeatGradeInventory.Grade.R,
            SeatGradeInventory.Grade.S,
            SeatGradeInventory.Grade.A
    );
    private static final List<BigDecimal> PRICE_RATES = List.of(
            new BigDecimal("1.60"),
            BigDecimal.ONE,
            new BigDecimal("0.68"),
            new BigDecimal("0.45")
    );

    private final CourseRepository courseRepository;
    private final PerformanceScheduleRepository scheduleRepository;
    private final SeatGradeInventoryRepository inventoryRepository;

    @Transactional
    public void createDefaultSchedules(Course course) {
        int totalCapacity = course.getCapacity() == null ? 1560 : course.getCapacity();
        int scheduleCount = Math.min(3, totalCapacity);
        int[] roundCapacities = distribute(totalCapacity, scheduleCount);
        LocalDate base = LocalDate.now().plusDays(7);
        int[] dayOffsets = {0, 2, 3};
        LocalTime[] times = {LocalTime.of(19, 30), LocalTime.of(15, 0), LocalTime.of(19, 0)};

        for (int i = 0; i < scheduleCount; i++) {
            PerformanceSchedule schedule = scheduleRepository.save(PerformanceSchedule.builder()
                    .courseId(course.getId())
                    .performanceDate(base.plusDays(dayOffsets[i]))
                    .performanceTime(times[i])
                    .build());
            createInventories(schedule.getId(), course.getPrice(), roundCapacities[i]);
        }
    }

    public List<PerformanceDto.ScheduleResponse> getSchedules(Long courseId) {
        requireCourse(courseId);
        return scheduleRepository.findByCourseIdAndStatusOrderByPerformanceDateAscPerformanceTimeAsc(
                        courseId, PerformanceSchedule.Status.ACTIVE).stream()
                .map(this::toResponse)
                .toList();
    }

    public PerformanceDto.ScheduleResponse getSchedule(Long courseId, Long scheduleId) {
        PerformanceSchedule schedule = scheduleRepository.findByIdAndCourseId(scheduleId, courseId)
                .orElseThrow(() -> new IllegalArgumentException("공연 회차를 찾을 수 없습니다: " + scheduleId));
        return toResponse(schedule);
    }

    @Transactional
    public PerformanceDto.ScheduleResponse addSchedule(
            Long courseId, Long instructorId, PerformanceDto.CreateScheduleRequest request) {
        Course course = requireCourse(courseId);
        if (!course.getInstructorId().equals(instructorId)) {
            throw new org.springframework.security.access.AccessDeniedException("본인이 등록한 공연만 회차를 추가할 수 있습니다");
        }
        PerformanceSchedule schedule = scheduleRepository.save(PerformanceSchedule.builder()
                .courseId(courseId)
                .performanceDate(request.getDate())
                .performanceTime(request.getTime())
                .build());

        List<PerformanceDto.GradeRequest> grades = request.getGrades();
        if (grades == null || grades.isEmpty()) {
            createInventories(schedule.getId(), course.getPrice(), course.getCapacity() == null ? 520 : course.getCapacity());
        } else {
            inventoryRepository.saveAll(grades.stream().map(g -> SeatGradeInventory.builder()
                    .scheduleId(schedule.getId())
                    .grade(parseGrade(g.getGrade()))
                    .price(g.getPrice())
                    .capacity(g.getCapacity())
                    .build()).toList());
        }
        return toResponse(schedule);
    }

    public List<PerformanceDto.SalesResponse> getSales(Long courseId) {
        return getSchedules(courseId).stream().map(schedule -> {
            int capacity = schedule.getGrades().stream().mapToInt(PerformanceDto.GradeResponse::getCapacity).sum();
            int sold = schedule.getGrades().stream().mapToInt(PerformanceDto.GradeResponse::getSold).sum();
            return PerformanceDto.SalesResponse.builder()
                    .id(schedule.getId())
                    .date(schedule.getDate())
                    .weekday(schedule.getWeekday())
                    .time(schedule.getTime())
                    .capacity(capacity)
                    .sold(sold)
                    .rate(capacity == 0 ? 0 : (int) Math.round(sold * 100.0 / capacity))
                    .build();
        }).toList();
    }

    @Transactional
    public PerformanceDto.InventoryResponse reserve(PerformanceDto.InventoryRequest request) {
        PerformanceSchedule schedule = scheduleRepository.findByIdAndCourseId(request.getScheduleId(), request.getCourseId())
                .orElseThrow(() -> new IllegalArgumentException("공연 회차를 찾을 수 없습니다: " + request.getScheduleId()));
        if (schedule.getStatus() != PerformanceSchedule.Status.ACTIVE) {
            throw new IllegalArgumentException("예매가 종료된 공연 회차입니다");
        }
        SeatGradeInventory inventory = inventoryRepository.findForUpdate(schedule.getId(), parseGrade(request.getGrade()))
                .orElseThrow(() -> new IllegalArgumentException("좌석 등급을 찾을 수 없습니다: " + request.getGrade()));
        inventory.reserve(request.getQuantity());
        return inventoryResponse(request, inventory);
    }

    @Transactional
    public PerformanceDto.InventoryResponse release(PerformanceDto.InventoryRequest request) {
        SeatGradeInventory inventory = inventoryRepository.findForUpdate(request.getScheduleId(), parseGrade(request.getGrade()))
                .orElseThrow(() -> new IllegalArgumentException("좌석 등급을 찾을 수 없습니다: " + request.getGrade()));
        inventory.release(request.getQuantity());
        return inventoryResponse(request, inventory);
    }

    public PerformanceDto.AvailabilityResponse firstAvailability(Long courseId) {
        for (PerformanceDto.ScheduleResponse schedule : getSchedules(courseId)) {
            for (PerformanceDto.GradeResponse grade : schedule.getGrades()) {
                if (grade.getCapacity() - grade.getSold() > 0) {
                    return PerformanceDto.AvailabilityResponse.builder()
                            .courseId(courseId)
                            .available(true)
                            .scheduleId(schedule.getId())
                            .grade(grade.getGrade())
                            .build();
                }
            }
        }
        return PerformanceDto.AvailabilityResponse.builder().courseId(courseId).available(false).build();
    }

    private PerformanceDto.InventoryResponse inventoryResponse(
            PerformanceDto.InventoryRequest request, SeatGradeInventory inventory) {
        return PerformanceDto.InventoryResponse.builder()
                .courseId(request.getCourseId())
                .scheduleId(request.getScheduleId())
                .grade(inventory.getGrade().name())
                .quantity(request.getQuantity())
                .unitPrice(inventory.getPrice())
                .amount(inventory.getPrice().multiply(BigDecimal.valueOf(request.getQuantity())))
                .remaining(inventory.remaining())
                .build();
    }

    private PerformanceDto.ScheduleResponse toResponse(PerformanceSchedule schedule) {
        return PerformanceDto.ScheduleResponse.from(
                schedule, inventoryRepository.findByScheduleIdOrderById(schedule.getId()));
    }

    private Course requireCourse(Long courseId) {
        return courseRepository.findById(courseId)
                .orElseThrow(() -> new IllegalArgumentException("공연을 찾을 수 없습니다: " + courseId));
    }

    private void createInventories(Long scheduleId, BigDecimal basePrice, int capacity) {
        int[] caps = distribute(capacity, 4);
        List<SeatGradeInventory> inventories = new ArrayList<>();
        for (int i = 0; i < GRADES.size(); i++) {
            BigDecimal price = basePrice.multiply(PRICE_RATES.get(i))
                    .divide(new BigDecimal("1000"), 0, RoundingMode.HALF_UP)
                    .multiply(new BigDecimal("1000"));
            inventories.add(SeatGradeInventory.builder()
                    .scheduleId(scheduleId)
                    .grade(GRADES.get(i))
                    .price(price)
                    .capacity(caps[i])
                    .build());
        }
        inventoryRepository.saveAll(inventories);
    }

    private int[] distribute(int total, int size) {
        int[] result = new int[size];
        for (int i = 0; i < total; i++) {
            result[i % size]++;
        }
        return result;
    }

    private SeatGradeInventory.Grade parseGrade(String grade) {
        try {
            return SeatGradeInventory.Grade.valueOf(grade.toUpperCase());
        } catch (Exception e) {
            throw new IllegalArgumentException("지원하지 않는 좌석 등급입니다: " + grade);
        }
    }
}
