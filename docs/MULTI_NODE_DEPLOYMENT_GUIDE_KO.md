# 단일 서버 내 5개 노드 배포 가이드 (Docker 기반)

현재 운영 중인 클라우드 서버 1대에서 5개의 독립적인 노드를 효율적으로 운영하기 위한 배포 전략입니다.

## 1. 배포 아키텍처
Docker 컨테이너를 사용하여 각 노드를 격리하며, 포트 포워딩을 통해 외부와 통신합니다.

- **노드 1 (Bootnode/Full Node)**: 네트워크의 중심축 (포트 8545)
- **노드 2~5 (Validators)**: 블록 생성 및 검증 참여 (포트 8546~8549)

## 2. 주요 설정 요구사항

### 2.1 포트 맵핑 (Port Mapping)
각 컨테이너는 충돌을 피하기 위해 고유한 외부 포트가 필요합니다.

| 서비스 명 | RPC 포트 | P2P 포트 (Discovery) | 역할 |
|:---:|:---:|:---:|:---:|
| `vision-node-1` | 8545 | 30303 | Bootnode & RPC |
| `vision-node-2` | 8546 | 30304 | Validator 1 |
| `vision-node-3` | 8547 | 30305 | Validator 2 |
| `vision-node-4` | 8548 | 30306 | Validator 3 |
| `vision-node-5` | 8549 | 30307 | Validator 4 |

### 2.2 디렉토리 구조
데이터가 섞이지 않도록 각 노드별로 전용 저장소를 할당합니다.
```bash
/vision-network
  ├── docker-compose.yml
  ├── common-config/
  │   └── genesis.json
  ├── node1/ (data & keys)
  ├── node2/
  ├── node3/
  ├── node4/
  └── node5/
```

## 3. 실행 방법 (요약)

1.  **구성 파일 준비**: 노드별 `nodekey`와 `genesis.json`을 각 폴더에 배치합니다.
2.  **Docker Compose 작성**: 5개의 서비스를 정의하고 각각 다른 포트와 볼륨을 연결합니다.
3.  **네트워크 시작**: `docker-compose up -d` 명령어로 한 번에 실행합니다.

## 4. 운영 시 주의사항
- **CPU/RAM 할당**: 서버의 전체 리소스가 100%에 도달하지 않도록 Docker 설정에서 컨테이너당 리소스 제한(`deploy.resources.limits`)을 거는 것이 안전합니다.
- **모니터링**: 5개 노드가 동시에 돌면 디스크 쓰기 부하가 늘어나므로, `iostat` 명령어로 지연 시간이 늘어나는지 주기적으로 확인이 필요합니다.

---
이 구성을 지금 서버에 적용하시려면 실제 `docker-compose.yml` 샘플 코드를 생성해 드릴 수 있습니다. 어떻게 진행할까요?
