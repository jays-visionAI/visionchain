# Vision Node v1.1.0 Release Announcement
## Distributed Storage Network Upgrade

---

### English

**Vision Node v1.1.0 is now available!**

This major update transforms every Vision Node into an active participant in the distributed storage network. Your node now stores and serves data chunks directly, significantly reducing reliance on centralized cloud storage and strengthening the Vision Chain network.

**What's New:**

- **Distributed Chunk Storage** -- Your node now stores encrypted data chunks on local disk (up to 50GB) and serves them via HTTP to other users on the network
- **Automatic Replication** -- The chunk registry system continuously monitors data availability and assigns under-replicated chunks to your node for downloading and storage
- **Direct Node Downloads** -- When someone requests data, the system routes the download directly to nodes that hold the chunks, with cloud fallback only if needed
- **Apple Notarization** -- macOS builds are now fully notarized by Apple, so you can install without security warnings

**Downloads:**

| Platform | Download |
|----------|----------|
| macOS (Apple Silicon) | [VisionNode-1.1.0-arm64.dmg](https://github.com/jays-visionAI/visionchain/releases/download/node-v1.1.0/VisionNode-1.1.0-arm64.dmg) |
| macOS (Intel) | [VisionNode-1.1.0-x64.dmg](https://github.com/jays-visionAI/visionchain/releases/download/node-v1.1.0/VisionNode-1.1.0-x64.dmg) |
| Windows | [VisionNode-Setup-1.1.0.exe](https://github.com/jays-visionAI/visionchain/releases/download/node-v1.1.0/VisionNode-Setup-1.1.0.exe) |

**System Requirements:** macOS 12+ / Windows 10+ / 500MB available disk space (recommended: 5GB+)

---

### 한국어

**Vision Node v1.1.0이 출시되었습니다!**

이번 업데이트는 모든 Vision Node를 분산 스토리지 네트워크의 능동적인 참여자로 전환합니다. 이제 노드가 데이터 청크를 직접 저장하고 서빙하여 중앙집중형 클라우드 스토리지에 대한 의존도를 크게 줄이고 Vision Chain 네트워크를 더 강화합니다.

**주요 변경사항:**

- **분산 청크 스토리지** -- 노드가 암호화된 데이터 청크를 로컬 디스크에 저장(최대 50GB)하고 HTTP를 통해 네트워크의 다른 사용자에게 직접 서빙합니다
- **자동 복제** -- 청크 레지스트리 시스템이 데이터 가용성을 지속적으로 모니터링하고, 복제본이 부족한 청크를 노드에 할당하여 다운로드/저장합니다
- **노드 직접 다운로드** -- 데이터 요청 시 청크를 보유한 노드에서 직접 다운로드하며, 필요한 경우에만 클라우드 폴백을 사용합니다
- **Apple 공증** -- macOS 빌드가 Apple에 의해 완전히 공증되어 보안 경고 없이 설치할 수 있습니다

**다운로드:**

| 플랫폼 | 다운로드 |
|--------|----------|
| macOS (Apple Silicon) | [VisionNode-1.1.0-arm64.dmg](https://github.com/jays-visionAI/visionchain/releases/download/node-v1.1.0/VisionNode-1.1.0-arm64.dmg) |
| macOS (Intel) | [VisionNode-1.1.0-x64.dmg](https://github.com/jays-visionAI/visionchain/releases/download/node-v1.1.0/VisionNode-1.1.0-x64.dmg) |
| Windows | [VisionNode-Setup-1.1.0.exe](https://github.com/jays-visionAI/visionchain/releases/download/node-v1.1.0/VisionNode-Setup-1.1.0.exe) |

**시스템 요구사항:** macOS 12+ / Windows 10+ / 최소 500MB 여유 디스크 공간 (권장: 5GB 이상)

**업데이트 방법:** 위 링크에서 최신 버전을 다운로드하여 기존 앱 위에 설치하면 됩니다. 기존 설정과 데이터는 유지됩니다.

---

**모바일 노드 (Android)도 분산 스토리지 기능이 추가되었습니다.** WiFi 접속 시 자동으로 청크 저장 및 레지스트리 동기화에 참여하며, 최대 50GB까지 스토리지를 할당할 수 있습니다.
