-- INTicket domain-owned MariaDB schemas.
-- Run on a clean volume: docker compose down -v && docker compose up --build

CREATE DATABASE IF NOT EXISTS lecture_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS performance_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS booking_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS payment_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

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
