-- INTicket MariaDB schemas and MVP seed data.
-- Idempotent: runs on a new volume and on every Compose start via db-migration.

CREATE DATABASE IF NOT EXISTS lecture_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS performance_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS booking_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS payment_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'manager'@'%' IDENTIFIED BY 'SqlDba-1';
GRANT ALL PRIVILEGES ON lecture_db.* TO 'manager'@'%';
GRANT ALL PRIVILEGES ON performance_db.* TO 'manager'@'%';
GRANT ALL PRIVILEGES ON booking_db.* TO 'manager'@'%';
GRANT ALL PRIVILEGES ON payment_db.* TO 'manager'@'%';
FLUSH PRIVILEGES;

USE lecture_db;

CREATE TABLE IF NOT EXISTS users (
    id BIGINT NOT NULL AUTO_INCREMENT,
    email VARCHAR(255) NOT NULL,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'STUDENT',
    created_at DATETIME(6) NULL,
    updated_at DATETIME(6) NULL,
    CONSTRAINT pk_users PRIMARY KEY (id),
    CONSTRAINT uq_users_email UNIQUE (email),
    CONSTRAINT ck_users_role CHECK (role IN ('STUDENT', 'INSTRUCTOR'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- The bundled Auth Server uses email as the login identifier and expects BCrypt.
-- Both MVP accounts use password1234.
INSERT IGNORE INTO users (id, email, password, name, role, created_at, updated_at) VALUES
    (1, 'student@lecture.com',
     '$2a$10$YU3FYSeEM/LrEadFOQOWweXZNgEXzX2O9JDxTUXfiBR1iyQhr/YJC',
     '김관람', 'STUDENT', NOW(6), NOW(6)),
    (2, 'instructor@lecture.com',
     '$2a$10$mSKua4VGb21Vnyuq3b0pZOzdXt5GBzMpXAD1Xrn/wULmGs4VcL/ya',
     '한기획', 'INSTRUCTOR', NOW(6), NOW(6));

USE performance_db;

CREATE TABLE IF NOT EXISTS courses (
    id BIGINT NOT NULL AUTO_INCREMENT,
    title VARCHAR(255) NOT NULL,
    description TEXT NULL,
    category VARCHAR(50) NOT NULL,
    price DECIMAL(12,2) NOT NULL,
    instructor_id BIGINT NOT NULL,
    enrollment_count INT NOT NULL DEFAULT 0,
    capacity INT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at DATETIME(6) NULL,
    updated_at DATETIME(6) NULL,
    CONSTRAINT pk_courses PRIMARY KEY (id),
    CONSTRAINT ck_courses_category CHECK (category IN ('BACKEND','FRONTEND','DEVOPS','DATA_SCIENCE','MOBILE','SECURITY','DATABASE','OTHER')),
    CONSTRAINT ck_courses_price CHECK (price >= 0),
    CONSTRAINT ck_courses_capacity CHECK (capacity IS NULL OR capacity > 0),
    CONSTRAINT ck_courses_count CHECK (enrollment_count >= 0),
    CONSTRAINT ck_courses_status CHECK (status IN ('ACTIVE', 'INACTIVE')),
    INDEX ix_courses_instructor (instructor_id),
    INDEX ix_courses_category_status (category, status),
    INDEX ix_courses_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS performance_schedules (
    id BIGINT NOT NULL AUTO_INCREMENT,
    course_id BIGINT NOT NULL,
    performance_date DATE NOT NULL,
    performance_time TIME NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at DATETIME(6) NULL,
    CONSTRAINT pk_performance_schedules PRIMARY KEY (id),
    CONSTRAINT fk_schedules_course FOREIGN KEY (course_id) REFERENCES courses(id),
    CONSTRAINT uq_schedule_course_datetime UNIQUE (course_id, performance_date, performance_time),
    CONSTRAINT ck_schedule_status CHECK (status IN ('ACTIVE', 'CLOSED')),
    INDEX ix_schedule_course_date (course_id, performance_date, performance_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS seat_grade_inventory (
    id BIGINT NOT NULL AUTO_INCREMENT,
    schedule_id BIGINT NOT NULL,
    grade VARCHAR(10) NOT NULL,
    price DECIMAL(12,2) NOT NULL,
    capacity INT NOT NULL,
    sold INT NOT NULL DEFAULT 0,
    version BIGINT NULL DEFAULT 0,
    CONSTRAINT pk_seat_grade_inventory PRIMARY KEY (id),
    CONSTRAINT uq_inventory_schedule_grade UNIQUE (schedule_id, grade),
    CONSTRAINT fk_inventory_schedule FOREIGN KEY (schedule_id) REFERENCES performance_schedules(id),
    CONSTRAINT ck_inventory_grade CHECK (grade IN ('VIP', 'R', 'S', 'A')),
    CONSTRAINT ck_inventory_price CHECK (price >= 0),
    CONSTRAINT ck_inventory_counts CHECK (capacity >= 0 AND sold >= 0 AND sold <= capacity)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Frontend MVP catalogue. Fixed IDs allow domain services to reference one another
-- without cross-schema foreign keys.
INSERT IGNORE INTO courses
    (id, title, description, category, price, instructor_id, enrollment_count, capacity, status, created_at, updated_at)
VALUES
    (1, '뮤지컬 오페라의 유령',
     '일시 2026.09.12(토) 19:30\n장소 블루스퀘어 신한카드홀\n관람시간 160분(인터미션 20분 포함)\n관람등급 14세 이상\n\n파리 오페라 하우스 지하에 사는 유령과 젊은 소프라노의 이야기.',
     'BACKEND', 150000, 2, 842, 842, 'ACTIVE', NOW(6) - INTERVAL 7 DAY, NOW(6)),
    (2, '연극 고도를 기다리며',
     '일시 2026.09.19(토) 20:00\n장소 LG아트센터 서울\n관람시간 120분(인터미션 없음)\n관람등급 14세 이상\n\n나무 한 그루와 돌 하나, 네 명의 배우가 기다림으로 채우는 무대.',
     'FRONTEND', 60000, 2, 317, 320, 'ACTIVE', NOW(6) - INTERVAL 6 DAY, NOW(6)),
    (3, '말러 교향곡 제2번 부활',
     '일시 2026.09.26(토) 20:00\n장소 롯데콘서트홀\n관람시간 95분(인터미션 없음)\n관람등급 초등학생 이상\n\n대편성 오케스트라와 합창단, 오르간이 함께하는 장대한 피날레.',
     'DATA_SCIENCE', 100000, 2, 521, 900, 'ACTIVE', NOW(6) - INTERVAL 5 DAY, NOW(6)),
    (4, 'THE FIRST LIGHT 콘서트',
     '일시 2026.10.03(토) 18:00\n장소 KSPO DOME\n관람시간 150분\n관람등급 8세 이상\n\n빛과 밴드 사운드가 어우러지는 단독 콘서트.',
     'DEVOPS', 132000, 2, 1204, 1204, 'ACTIVE', NOW(6) - INTERVAL 4 DAY, NOW(6)),
    (5, '뮤지컬 레미제라블',
     '일시 2026.09.13(일) 14:00\n장소 샤롯데씨어터\n관람시간 175분(인터미션 20분 포함)\n관람등급 8세 이상\n\n바리케이드 회전 무대와 웅장한 라이브 오케스트라가 함께합니다.',
     'BACKEND', 140000, 2, 678, 1000, 'ACTIVE', NOW(6) - INTERVAL 3 DAY, NOW(6)),
    (6, '연극 한여름 밤의 꿈',
     '일시 2026.09.13(일) 15:00\n장소 예술의전당 자유소극장\n관람시간 145분\n관람등급 8세 이상\n\n셰익스피어의 숲을 현대적으로 재해석한 로맨틱 코미디.',
     'FRONTEND', 45000, 2, 132, 400, 'ACTIVE', NOW(6) - INTERVAL 2 DAY, NOW(6)),
    (7, '베토벤 피아노 협주곡 전곡',
     '일시 2026.10.10(토) 17:00\n장소 예술의전당 콘서트홀\n관람시간 130분(인터미션 20분 포함)\n관람등급 초등학생 이상\n\n한 무대에서 만나는 베토벤 피아노 협주곡의 정수.',
     'DATA_SCIENCE', 88000, 2, 94, 500, 'ACTIVE', NOW(6) - INTERVAL 1 DAY, NOW(6));

INSERT IGNORE INTO performance_schedules
    (id, course_id, performance_date, performance_time, status, created_at)
VALUES
    (101, 1, '2026-09-12', '19:30:00', 'ACTIVE', NOW(6)),
    (102, 1, '2026-09-13', '14:00:00', 'ACTIVE', NOW(6)),
    (201, 2, '2026-09-19', '20:00:00', 'ACTIVE', NOW(6)),
    (202, 2, '2026-09-20', '15:00:00', 'ACTIVE', NOW(6)),
    (301, 3, '2026-09-26', '20:00:00', 'ACTIVE', NOW(6)),
    (302, 3, '2026-09-27', '17:00:00', 'ACTIVE', NOW(6)),
    (401, 4, '2026-10-03', '18:00:00', 'ACTIVE', NOW(6)),
    (402, 4, '2026-10-04', '17:00:00', 'ACTIVE', NOW(6)),
    (501, 5, '2026-09-13', '14:00:00', 'ACTIVE', NOW(6)),
    (502, 5, '2026-09-15', '19:30:00', 'ACTIVE', NOW(6)),
    (601, 6, '2026-09-13', '15:00:00', 'ACTIVE', NOW(6)),
    (602, 6, '2026-09-20', '15:00:00', 'ACTIVE', NOW(6)),
    (701, 7, '2026-10-10', '17:00:00', 'ACTIVE', NOW(6)),
    (702, 7, '2026-10-11', '17:00:00', 'ACTIVE', NOW(6));

-- Vary stock levels to show sold-out, nearly sold-out and available states.
INSERT IGNORE INTO seat_grade_inventory
    (schedule_id, grade, price, capacity, sold, version)
VALUES
    (101, 'VIP', 240000, 106, 106, 0), (101, 'R', 150000, 105, 105, 0),
    (101, 'S', 102000, 105, 105, 0), (101, 'A', 68000, 105, 105, 0),
    (102, 'VIP', 240000, 106, 106, 0), (102, 'R', 150000, 105, 105, 0),
    (102, 'S', 102000, 105, 105, 0), (102, 'A', 68000, 105, 105, 0),
    (201, 'VIP', 96000, 40, 40, 0), (201, 'R', 60000, 40, 40, 0),
    (201, 'S', 41000, 40, 40, 0), (201, 'A', 27000, 40, 40, 0),
    (202, 'VIP', 96000, 40, 40, 0), (202, 'R', 60000, 40, 40, 0),
    (202, 'S', 41000, 40, 39, 0), (202, 'A', 27000, 40, 38, 0),
    (301, 'VIP', 160000, 113, 90, 0), (301, 'R', 100000, 112, 75, 0),
    (301, 'S', 68000, 112, 60, 0), (301, 'A', 45000, 113, 45, 0),
    (302, 'VIP', 160000, 113, 82, 0), (302, 'R', 100000, 112, 68, 0),
    (302, 'S', 68000, 112, 56, 0), (302, 'A', 45000, 113, 45, 0),
    (401, 'VIP', 211000, 151, 151, 0), (401, 'R', 132000, 150, 150, 0),
    (401, 'S', 90000, 150, 150, 0), (401, 'A', 59000, 151, 151, 0),
    (402, 'VIP', 211000, 151, 151, 0), (402, 'R', 132000, 150, 150, 0),
    (402, 'S', 90000, 150, 150, 0), (402, 'A', 59000, 151, 151, 0),
    (501, 'VIP', 224000, 125, 112, 0), (501, 'R', 140000, 125, 97, 0),
    (501, 'S', 95000, 125, 79, 0), (501, 'A', 63000, 125, 51, 0),
    (502, 'VIP', 224000, 125, 109, 0), (502, 'R', 140000, 125, 94, 0),
    (502, 'S', 95000, 125, 76, 0), (502, 'A', 63000, 125, 60, 0),
    (601, 'VIP', 72000, 50, 28, 0), (601, 'R', 45000, 50, 21, 0),
    (601, 'S', 31000, 50, 11, 0), (601, 'A', 20000, 50, 6, 0),
    (602, 'VIP', 72000, 50, 27, 0), (602, 'R', 45000, 50, 20, 0),
    (602, 'S', 31000, 50, 11, 0), (602, 'A', 20000, 50, 8, 0),
    (701, 'VIP', 141000, 63, 20, 0), (701, 'R', 88000, 62, 15, 0),
    (701, 'S', 60000, 62, 8, 0), (701, 'A', 40000, 63, 4, 0),
    (702, 'VIP', 141000, 63, 18, 0), (702, 'R', 88000, 62, 14, 0),
    (702, 'S', 60000, 62, 10, 0), (702, 'A', 40000, 63, 5, 0);

USE booking_db;

CREATE TABLE IF NOT EXISTS seat_holds (
    id BIGINT NOT NULL AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    course_id BIGINT NOT NULL,
    schedule_id BIGINT NOT NULL,
    grade VARCHAR(10) NOT NULL,
    quantity INT NOT NULL,
    unit_price DECIMAL(12,2) NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'HELD',
    expires_at DATETIME(6) NOT NULL,
    created_at DATETIME(6) NULL,
    CONSTRAINT pk_seat_holds PRIMARY KEY (id),
    CONSTRAINT ck_hold_quantity CHECK (quantity BETWEEN 1 AND 4),
    CONSTRAINT ck_hold_amount CHECK (unit_price >= 0 AND amount >= 0),
    CONSTRAINT ck_hold_status CHECK (status IN ('HELD','CONFIRMED','RELEASED','EXPIRED')),
    INDEX ix_hold_expiry_status (status, expires_at),
    INDEX ix_hold_user_course (user_id, course_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS enrollments (
    id BIGINT NOT NULL AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    course_id BIGINT NOT NULL,
    hold_id BIGINT NULL,
    schedule_id BIGINT NULL,
    grade VARCHAR(10) NULL,
    quantity INT NOT NULL DEFAULT 1,
    unit_price DECIMAL(12,2) NULL,
    amount DECIMAL(12,2) NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    active_booking_key VARCHAR(100)
        AS (CASE WHEN status IN ('PENDING','ACTIVE') THEN CONCAT(user_id, ':', course_id) ELSE NULL END) STORED,
    created_at DATETIME(6) NULL,
    updated_at DATETIME(6) NULL,
    CONSTRAINT pk_enrollments PRIMARY KEY (id),
    CONSTRAINT uq_enrollments_hold UNIQUE (hold_id),
    CONSTRAINT uq_enrollments_active_booking UNIQUE (active_booking_key),
    CONSTRAINT fk_enrollments_hold FOREIGN KEY (hold_id) REFERENCES seat_holds(id),
    CONSTRAINT ck_enrollment_quantity CHECK (quantity BETWEEN 1 AND 4),
    CONSTRAINT ck_enrollment_status CHECK (status IN ('PENDING','ACTIVE','CANCELLED')),
    INDEX ix_enrollment_user_status (user_id, status, created_at),
    INDEX ix_enrollment_course_status (course_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS waitlists (
    id BIGINT NOT NULL AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    course_id BIGINT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'WAITING',
    claimed_at DATETIME(6) NULL,
    active_waiting_key VARCHAR(100)
        AS (CASE WHEN status = 'WAITING' THEN CONCAT(user_id, ':', course_id) ELSE NULL END) STORED,
    created_at DATETIME(6) NULL,
    CONSTRAINT pk_waitlists PRIMARY KEY (id),
    CONSTRAINT uq_waitlists_active_waiting UNIQUE (active_waiting_key),
    CONSTRAINT ck_waitlist_status CHECK (status IN ('WAITING','MATCHED')),
    INDEX ix_waitlist_course_status_created (course_id, status, claimed_at, created_at),
    INDEX ix_waitlist_user_status (user_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO seat_holds
    (id, user_id, course_id, schedule_id, grade, quantity, unit_price, amount, status, expires_at, created_at)
VALUES
    (9001, 1, 5, 501, 'R', 2, 140000, 280000, 'CONFIRMED', NOW(6) + INTERVAL 30 DAY, NOW(6) - INTERVAL 2 DAY),
    (9002, 1, 6, 601, 'S', 1, 31000, 31000, 'RELEASED', NOW(6) - INTERVAL 1 DAY, NOW(6) - INTERVAL 5 DAY);

INSERT IGNORE INTO enrollments
    (id, user_id, course_id, hold_id, schedule_id, grade, quantity, unit_price, amount, status, created_at, updated_at)
VALUES
    (8001, 1, 5, 9001, 501, 'R', 2, 140000, 280000, 'ACTIVE', NOW(6) - INTERVAL 2 DAY, NOW(6) - INTERVAL 2 DAY),
    (8002, 1, 6, 9002, 601, 'S', 1, 31000, 31000, 'CANCELLED', NOW(6) - INTERVAL 5 DAY, NOW(6) - INTERVAL 1 DAY);

INSERT IGNORE INTO waitlists
    (id, user_id, course_id, status, claimed_at, created_at)
VALUES
    (7001, 1, 1, 'WAITING', NULL, NOW(6) - INTERVAL 1 DAY);

USE payment_db;

CREATE TABLE IF NOT EXISTS payments (
    id BIGINT NOT NULL AUTO_INCREMENT,
    enrollment_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    course_id BIGINT NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    amount DECIMAL(12,2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    transaction_id VARCHAR(255) NULL,
    created_at DATETIME(6) NULL,
    updated_at DATETIME(6) NULL,
    CONSTRAINT pk_payments PRIMARY KEY (id),
    CONSTRAINT uq_payments_enrollment UNIQUE (enrollment_id),
    CONSTRAINT uq_payments_transaction UNIQUE (transaction_id),
    CONSTRAINT ck_payment_quantity CHECK (quantity BETWEEN 1 AND 4),
    CONSTRAINT ck_payment_amount CHECK (amount >= 0),
    CONSTRAINT ck_payment_status CHECK (status IN ('PENDING','COMPLETED','FAILED','CANCELLED')),
    INDEX ix_payment_user_created (user_id, created_at),
    INDEX ix_payment_course (course_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO payments
    (id, enrollment_id, user_id, course_id, quantity, amount, status, transaction_id, created_at, updated_at)
VALUES
    (6001, 8001, 1, 5, 2, 280000, 'COMPLETED', 'MVP-DEMO-COMPLETED-8001', NOW(6) - INTERVAL 2 DAY, NOW(6) - INTERVAL 2 DAY),
    (6002, 8002, 1, 6, 1, 31000, 'CANCELLED', 'MVP-DEMO-CANCELLED-8002', NOW(6) - INTERVAL 5 DAY, NOW(6) - INTERVAL 1 DAY);
