# 역할 템플릿

작업자와 리뷰어에게 부여하는 전문 역할 프롬프트 모음.
Task 매니저가 태스크 생성 시 적절한 역할을 지정한다.

## 사용법

Task frontmatter에서 역할을 지정한다:

```yaml
role: backend-dev              # 작업자 역할
reviewer_role: reviewer-strict # 리뷰어 역할
```

## 작업자 역할

| 파일 | 설명 |
|------|------|
| `general.md` | 기본 역할 (role 미지정 시 사용) |
| `backend-dev.md` | 백엔드 개발 (API, DB, 서버 로직) |
| `frontend-dev.md` | 프론트엔드 개발 (React, UI, 스타일링) |
| `test-engineer.md` | 테스트 (단위/통합/E2E, 커버리지) |
| `devops.md` | DevOps (Docker, CI/CD, 인프라) |
| `tech-writer.md` | 기술 문서 작성 |

## 리뷰어 역할

| 파일 | 설명 |
|------|------|
| `reviewer-general.md` | 기본 리뷰 (reviewer_role 미지정 시 사용) |
| `reviewer-strict.md` | 극도로 꼼꼼한 리뷰 (한 글자도 안 넘어감) |
| `reviewer-security.md` | 보안 전문 리뷰 (취약점 집중 검증) |

## 새 역할 추가

1. `docs/roles/역할명.md` 파일 생성
2. Task frontmatter에서 `role: 역할명` 또는 `reviewer_role: 역할명` 지정
3. 끝

## 참고

- 대시보드 태스크 분석·API와의 연동, 폴백 동작, 개선 후보: [role-catalog-task-analysis-improvements.md](../architecture/role-catalog-task-analysis-improvements.md)
