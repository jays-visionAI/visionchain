# Vision Node Desktop - macOS 코드 서명 & 공증 가이드

## 개요

macOS에서 DMG를 다운로드 후 바로 실행할 수 있으려면 **Apple Developer ID 서명 + Apple 공증(notarization)** 이 필요합니다.

---

## 1단계: Apple Developer 계정 등록

1. https://developer.apple.com/programs/ 접속
2. "Enroll" 클릭 -- 연 $99
3. 개인 또는 조직으로 등록 완료

---

## 2단계: Developer ID Application 인증서 생성

### Keychain Access에서 CSR 생성

```bash
# 1. Keychain Access 열기
open -a "Keychain Access"
```

1. 메뉴: **Keychain Access > Certificate Assistant > Request a Certificate from a Certificate Authority...**
2. email 입력, "Saved to disk" 선택 후 저장

### Apple Developer 사이트에서 인증서 생성

1. https://developer.apple.com/account/resources/certificates/add 접속
2. **Developer ID Application** 선택
3. CSR 파일 업로드
4. 인증서 다운로드 (.cer)
5. .cer 파일을 더블클릭하여 Keychain에 설치

### 인증서 확인

```bash
security find-identity -v -p codesigning
```

출력 예시:
```
1) ABC12345DEF "Developer ID Application: Vision Chain (TEAMID123)"
   1 valid identities found
```

### 인증서를 .p12로 내보내기 (CI/CD용)

1. Keychain Access에서 인증서를 찾음
2. 마우스 오른쪽 클릭 > "Export..."
3. .p12 형식으로 저장, 비밀번호 설정
4. Base64로 인코딩:
   ```bash
   base64 -i certificate.p12 -o certificate-base64.txt
   ```

---

## 3단계: App-Specific Password 생성

공증에 필요합니다.

1. https://appleid.apple.com/account/manage 접속
2. **Sign-In and Security > App-Specific Passwords** 선택
3. "Vision Node Build" 같은 라벨로 새 비밀번호 생성
4. 비밀번호를 안전한 곳에 저장

---

## 4단계: 환경변수 설정

```bash
# .env 파일 또는 쉘 프로필에 추가

# 인증서 (Keychain에 설치된 경우 자동 검색됨)
# CI/CD에서는 아래 변수 사용:
# export CSC_LINK="path/to/certificate.p12"
# export CSC_KEY_PASSWORD="p12-password"

# 공증 (notarization)
export APPLE_ID="your-apple-id@example.com"
export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"
export APPLE_TEAM_ID="TEAMID123"
```

---

## 5단계: 빌드

```bash
cd vision-node-app

# 의존성 설치 (최초 1회)
npm install

# 서명 + 공증 포함 빌드
npm run build:mac
```

빌드 과정:
1. Electron 앱 패키징
2. **Developer ID Application** 인증서로 코드 서명
3. **Apple 공증 서버**에 앱 제출 (1-5분 소요)
4. 공증 완료 후 **스테이플 (staple)** 처리
5. DMG 생성

결과물:
```
dist/Vision Node-1.0.0-arm64.dmg   # Apple Silicon
dist/Vision Node-1.0.0.dmg          # Intel
```

---

## 6단계: 테스트

```bash
# Gatekeeper 검증
spctl --assess --type execute --verbose "dist/mac-arm64/Vision Node.app"
# 결과: "accepted" 이면 성공

# 서명 확인
codesign --verify --deep --strict --verbose=2 "dist/mac-arm64/Vision Node.app"

# 공증 확인
xcrun stapler validate "dist/Vision Node-1.0.0-arm64.dmg"
```

---

## 서명 없이 빌드 (로컬 개발용)

```bash
npm run build:mac:unsigned
```

이 빌드는 서명/공증 없이 생성되므로 Gatekeeper에 의해 차단됩니다.
개발 테스트 시 `xattr -cr /Applications/Vision\ Node.app` 으로 우회 가능.

---

## Team ID 확인 방법

```bash
# Keychain에 설치된 인증서에서 Team ID 확인
security find-identity -v -p codesigning | grep "Developer ID"
# 괄호 안의 영숫자가 Team ID (예: TEAMID123)
```

또는 https://developer.apple.com/account > Membership Details에서 확인.

---

## 트러블슈팅

### "No identity found for signing"
- Keychain에 Developer ID Application 인증서가 없음
- `security find-identity -v -p codesigning`으로 확인

### 공증 실패: "The signature of the binary is invalid"
- `hardenedRuntime: true`가 설정되어 있는지 확인
- entitlements 파일이 올바른지 확인

### 공증 실패: "The app is not signed with a valid Developer ID certificate"
- 인증서가 "Developer ID Application"인지 확인 (Mac App Store용 아님)
- 인증서가 만료되지 않았는지 확인
