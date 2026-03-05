// Seed script: Run this once to populate the daily_tips collection in Firestore
// Usage: node scripts/seed-daily-tips.js  (after setting FIREBASE_SERVICE_ACCOUNT env or running via firebase admin)

const admin = require('firebase-admin');

// Initialize with default credentials (service account must be configured)
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.applicationDefault(),
    });
}

const db = admin.firestore();

const tips = [
    {
        id: 'tip_1',
        title: '당신의 레퍼럴코드가 있다는 것을 아셨나요? 레퍼럴러시 퀘스트에 참여해보세요.',
        body: '',
        targetView: 'quest',
        order: 1,
        enabled: true,
    },
    {
        id: 'tip_2',
        title: '레퍼럴코드로 초대하면 보상이 있다는 것을 아셨나요?',
        body: '친구를 초대하고 함께 보상을 받아보세요.',
        targetView: 'referral',
        order: 2,
        enabled: true,
    },
    {
        id: 'tip_3',
        title: '비전체인 테스트에 동참하시면 RP 보상이 있는 것을 아셨나요?',
        body: '',
        targetView: 'quest',
        order: 3,
        enabled: true,
    },
    {
        id: 'tip_4',
        title: 'RP는 VCN으로 교환되는 것을 아셨나요?',
        body: '활동을 통해 적립한 RP를 VCN 토큰으로 교환할 수 있습니다.',
        targetView: 'quest',
        order: 4,
        enabled: true,
    },
    {
        id: 'tip_5',
        title: '당신의 레퍼럴코드로 직계 방계까지 회원의 활동이 보상으로 올라옵니다.',
        body: '',
        targetView: 'referral',
        order: 5,
        enabled: true,
    },
    {
        id: 'tip_6',
        title: 'RP 보상은 뭘 하면 얻을 수 있을까요?',
        body: '퀘스트 메뉴에서 다양한 보상 활동을 확인해보세요.',
        targetView: 'quest',
        order: 6,
        enabled: true,
    },
    {
        id: 'tip_7',
        title: 'Contact 메뉴에 지인들 등록하면 이름만으로 코인 전송 가능한 걸 아셨나요?',
        body: '복잡한 지갑 주소 없이 이름으로 간편하게 전송하세요.',
        targetView: 'contacts',
        order: 7,
        enabled: true,
    },
    {
        id: 'tip_8',
        title: '업비트 빗썸과 같은 중앙화 거래소와 당신의 비전체인이 연동되는 것을 아셨나요?',
        body: '',
        targetView: 'cex',
        order: 8,
        enabled: true,
    },
    {
        id: 'tip_9',
        title: '당신의 휴대폰과 컴퓨터에 노드를 설치를 통해 수익 창출이 가능한 것을 아셨나요?',
        body: '비전 노드를 설치하고 네트워크에 기여하며 보상을 받으세요.',
        targetView: 'nodes',
        order: 9,
        enabled: true,
    },
    {
        id: 'tip_10',
        title: 'Disk에 당신의 소중한 파일을 암호화해서 저장 가능한 것을 아셨나요?',
        body: '',
        targetView: 'disk',
        order: 10,
        enabled: true,
    },
    {
        id: 'tip_11',
        title: '당신이 만든 콘텐츠를 Disk에 업로드하고 Market에 판매 가능한 것을 아셨나요?',
        body: '디지털 콘텐츠로 수익을 창출해보세요.',
        targetView: 'market',
        order: 11,
        enabled: true,
    },
    {
        id: 'tip_12',
        title: '니모닉 프레이즈 복구문구를 클라우드에 업로드할 수 있다는 것을 아셨나요?',
        body: '설정에서 복구문구를 안전하게 백업하세요.',
        targetView: 'settings',
        order: 12,
        enabled: true,
    },
    {
        id: 'tip_13',
        title: '거래내역은 기업회계기준에 맞게 분개하여 현행 회계기준 계정과목을 100% 포함합니다.',
        body: '',
        targetView: 'assets',
        order: 13,
        enabled: true,
    },
    {
        id: 'tip_14',
        title: 'Vision Insight에서 가상자산 시장의 뉴스가 매일 업데이트되어 시장 파악이 가능합니다.',
        body: '',
        targetView: 'insight',
        order: 14,
        enabled: true,
    },
    {
        id: 'tip_15',
        title: 'Chat에서 비전체인을 어떻게 사용하는지 물어보면 Vision AI가 답해줍니다.',
        body: '당신의 포트폴리오와 투자전략을 AI에게 맡겨보세요.',
        targetView: 'chat',
        order: 15,
        enabled: true,
    },
];

async function seed() {
    const now = Date.now();
    const batch = db.batch();

    for (const tip of tips) {
        const { id, ...data } = tip;
        const ref = db.collection('daily_tips').doc(id);
        batch.set(ref, {
            ...data,
            createdAt: now,
            updatedAt: now,
        });
    }

    await batch.commit();
    console.log(`Seeded ${tips.length} daily tips successfully.`);
}

seed().catch(err => {
    console.error('Seed failed:', err);
    process.exit(1);
});
