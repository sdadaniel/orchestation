---
id: TASK-005
title: 짝수 파일 생성
status: done
priority: medium
depends_on:
    - TASK-004
blocks:
    - TASK-006
parallel_with:
    - TASK-002
owner: ""
branch: task/TASK-005-even-numbers
worktree: ../repo-wt-TASK-005
reviewer: ""
affected_files:
    - output/even-numbers.txt
---

## 무엇을

`output/even-numbers.txt` 파일을 생성하고 2, 4, 6, 8, 10을 한 줄에 하나씩 작성한다.

## 완료 조건

- [ ] `output/even-numbers.txt` 파일이 존재
- [ ] 2, 4, 6, 8, 10 짝수가 포함
