-- secondary 브랜치의 MVP 더미 데이터를 develop 스키마 컬럼에 맞춰 구성합니다.

-- 두 계정의 비밀번호는 password1234 입니다.
INSERT IGNORE INTO users
    (id, email, password, name, role, created_at, updated_at)
VALUES
    (1, 'student@lecture.com',
     '$2a$10$YU3FYSeEM/LrEadFOQOWweXZNgEXzX2O9JDxTUXfiBR1iyQhr/YJC',
     '김관람', 'STUDENT', NOW(6), NOW(6)),
    (2, 'instructor@lecture.com',
     '$2a$10$mSKua4VGb21Vnyuq3b0pZOzdXt5GBzMpXAD1Xrn/wULmGs4VcL/ya',
     '한기획', 'INSTRUCTOR', NOW(6), NOW(6));

INSERT IGNORE INTO courses
    (id, title, description, category, price, instructor_id, enrollment_count,
     status, created_at, updated_at)
VALUES
    (1, '뮤지컬 오페라의 유령',
     '일시 2026.09.12(토) 19:30\n장소 블루스퀘어 신한카드홀\n관람시간 160분(인터미션 20분 포함)\n관람등급 14세 이상\n\n파리 오페라 하우스 지하에 사는 유령과 젊은 소프라노의 이야기.',
     'BACKEND', 150000, 2, 842, 'ACTIVE', NOW(6) - INTERVAL 7 DAY, NOW(6)),
    (2, '연극 고도를 기다리며',
     '일시 2026.09.19(토) 20:00\n장소 LG아트센터 서울\n관람시간 120분(인터미션 없음)\n관람등급 14세 이상\n\n나무 한 그루와 돌 하나, 네 명의 배우가 기다림으로 채우는 무대.',
     'FRONTEND', 60000, 2, 317, 'ACTIVE', NOW(6) - INTERVAL 6 DAY, NOW(6)),
    (3, '말러 교향곡 제2번 부활',
     '일시 2026.09.26(토) 20:00\n장소 롯데콘서트홀\n관람시간 95분(인터미션 없음)\n관람등급 초등학생 이상\n\n대편성 오케스트라와 합창단, 오르간이 함께하는 장대한 피날레.',
     'DATA_SCIENCE', 100000, 2, 521, 'ACTIVE', NOW(6) - INTERVAL 5 DAY, NOW(6)),
    (4, 'THE FIRST LIGHT 콘서트',
     '일시 2026.10.03(토) 18:00\n장소 KSPO DOME\n관람시간 150분\n관람등급 8세 이상\n\n빛과 밴드 사운드가 어우러지는 단독 콘서트.',
     'DEVOPS', 132000, 2, 1204, 'ACTIVE', NOW(6) - INTERVAL 4 DAY, NOW(6)),
    (5, '뮤지컬 레미제라블',
     '일시 2026.09.13(일) 14:00\n장소 샤롯데씨어터\n관람시간 175분(인터미션 20분 포함)\n관람등급 8세 이상\n\n바리케이드 회전 무대와 웅장한 라이브 오케스트라가 함께합니다.',
     'BACKEND', 140000, 2, 678, 'ACTIVE', NOW(6) - INTERVAL 3 DAY, NOW(6)),
    (6, '연극 한여름 밤의 꿈',
     '일시 2026.09.13(일) 15:00\n장소 예술의전당 자유소극장\n관람시간 145분\n관람등급 8세 이상\n\n셰익스피어의 숲을 현대적으로 재해석한 로맨틱 코미디.',
     'FRONTEND', 45000, 2, 132, 'ACTIVE', NOW(6) - INTERVAL 2 DAY, NOW(6)),
    (7, '베토벤 피아노 협주곡 전곡',
     '일시 2026.10.10(토) 17:00\n장소 예술의전당 콘서트홀\n관람시간 130분(인터미션 20분 포함)\n관람등급 초등학생 이상\n\n한 무대에서 만나는 베토벤 피아노 협주곡의 정수.',
     'DATA_SCIENCE', 88000, 2, 94, 'ACTIVE', NOW(6) - INTERVAL 1 DAY, NOW(6));

INSERT IGNORE INTO enrollments
    (id, user_id, course_id, status, created_at, updated_at)
VALUES
    (8001, 1, 5, 'ACTIVE', NOW(6) - INTERVAL 2 DAY, NOW(6) - INTERVAL 2 DAY),
    (8002, 1, 6, 'CANCELLED', NOW(6) - INTERVAL 5 DAY, NOW(6) - INTERVAL 1 DAY);

INSERT IGNORE INTO payments
    (id, user_id, course_id, amount, status, transaction_id, created_at, updated_at)
VALUES
    (6001, 1, 5, 280000, 'COMPLETED', 'MVP-DEMO-COMPLETED-8001',
     NOW(6) - INTERVAL 2 DAY, NOW(6) - INTERVAL 2 DAY),
    (6002, 1, 6, 31000, 'CANCELLED', 'MVP-DEMO-CANCELLED-8002',
     NOW(6) - INTERVAL 5 DAY, NOW(6) - INTERVAL 1 DAY);
