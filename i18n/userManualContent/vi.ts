/**
 * User Manual Content - Vietnamese (Tiếng Việt)
 * All translatable body text for the User Guide, organized by section ID.
 */
export const vi: Record<string, any> = {
  _labels: { tip: 'MẸO', warning: 'CẢNH BÁO', note: 'LƯU Ý', prerequisites: 'YÊU CẦU CHUẨN BỊ', backToHome: 'Quay lại Trang chủ', versionLabel: 'Hướng dẫn sử dụng Vision Chain v1.0' },

  'gs-overview': {
    title: 'Chào mừng đến với Vision Chain',
    desc: 'Vision Chain là một hệ sinh thái blockchain được hỗ trợ bởi AI. Hướng dẫn này sẽ dẫn dắt bạn qua mọi tính năng của Ví Vision Chain.',
    features: [
      { n: 'AI Chat', d: 'Trò chuyện với Vision AI để thực hiện giao dịch, đặt câu hỏi và các thao tác blockchain' },
      { n: 'Đa chuỗi', d: 'Quản lý tài sản trên Vision Chain, Ethereum, Polygon và Base' },
      { n: 'Không phí gas', d: 'Mọi giao dịch đều không mất phí gas thông qua hệ thống Vision Paymaster' },
    ],
    quickNavTitle: 'Điều hướng nhanh',
    quickNav: [
      { t: 'Người dùng mới?', d: 'Bắt đầu với Tạo tài khoản & Đăng nhập' },
      { t: 'Đã có tài khoản?', d: 'Tìm hiểu về giao diện AI Chat' },
      { t: 'Muốn gửi token?', d: 'Chuyển đến hướng dẫn Gửi & Nhận' },
      { t: 'Cần bảo mật?', d: 'Kiểm tra Cài đặt & thiết lập 2FA' },
    ],
  },
  'gs-signup': {
    title: 'Tạo tài khoản & Đăng nhập',
    desc: 'Tạo tài khoản Vision Chain của bạn để truy cập ví và tất cả các tính năng.',
    steps: [
      { title: 'Truy cập visionchain.co', desc: 'Đi đến trang web chính và nhấp "Launch App", hoặc truy cập trực tiếp visionchain.co/wallet.' },
      { title: 'Nhấp Đăng ký', desc: 'Trên trang đăng nhập, nhấn "Sign Up" để tạo tài khoản mới.' },
      { title: 'Nhập thông tin của bạn', desc: 'Cung cấp email, tên người dùng và một mật khẩu mạnh. Tùy chọn nhập mã giới thiệu nếu được bạn bè mời.' },
      { title: 'Xác minh email', desc: 'Kiểm tra hộp thư đến để tìm email xác minh và nhấp vào liên kết kích hoạt.' },
      { title: 'Đăng nhập', desc: 'Quay lại trang đăng nhập và đăng nhập bằng thông tin của bạn. Bạn sẽ được chuyển đến màn hình AI Chat.' },
    ],
    tip: 'Nếu bạn có mã giới thiệu từ bạn bè, hãy nhập nó khi đăng ký để nhận token VCN thưởng. Cả bạn và người giới thiệu đều sẽ nhận được phần thưởng.',
  },
  'gs-wallet': {
    title: 'Thiết lập ví',
    desc: 'Ví blockchain của bạn được tạo tự động khi đăng nhập lần đầu. Một cụm từ khôi phục (seed phrase) được tạo để sao lưu và khôi phục.',
    steps: [
      { title: 'Tự động tạo', desc: 'Khi đăng nhập lần đầu, ví được tạo tự động với một địa chỉ duy nhất. Không cần thiết lập thủ công.' },
      { title: 'Sao lưu cụm từ khôi phục', desc: 'Đi đến Cài đặt > Sao lưu ví. Ghi lại cụm từ khôi phục 12 từ của bạn và lưu trữ an toàn ở chế độ ngoại tuyến.' },
      { title: 'Đặt mật khẩu ví', desc: 'Tạo một mật khẩu ví riêng để ký giao dịch. Mật khẩu này khác với mật khẩu đăng nhập của bạn.' },
      { title: 'Đồng bộ đám mây (Tùy chọn)', desc: 'Bật Đồng bộ đám mây trong Cài đặt để sao lưu ví đã mã hóa của bạn lên Vision Cloud nhằm khôi phục trên nhiều thiết bị.' },
    ],
    warning: 'Cụm từ khôi phục là cách duy nhất để khôi phục ví nếu bạn mất quyền truy cập. Đừng bao giờ chia sẻ nó với bất kỳ ai. Bộ phận hỗ trợ Vision Chain sẽ không bao giờ hỏi cụm từ khôi phục của bạn.',
  },
  'gs-navigation': {
    title: 'Tổng quan giao diện',
    desc: 'Tìm hiểu cách điều hướng ví Vision Chain trên máy tính và thiết bị di động.',
    mobileNavTitle: 'Điều hướng trên di động',
    mobileNav: [
      { label: 'Menu Hamburger', desc: 'Nhấn biểu tượng menu ở góc trên bên trái để mở thanh bên chứa tất cả các tính năng' },
      { label: 'Lịch sử trò chuyện', desc: 'Nhấn biểu tượng đồng hồ ở góc trên bên phải để xem và chuyển đổi giữa các phiên AI chat' },
      { label: 'Ô nhập ở dưới cùng', desc: 'Khu vực nhập trò chuyện ở dưới cùng sẽ mở rộng khi được nhấn. Hỗ trợ nhập văn bản và giọng nói' },
      { label: 'Agent Desk', desc: 'Hiển thị các AI agent đang hoạt động và tác vụ chạy nền phía trên khu vực nhập' },
    ],
    desktopNavTitle: 'Điều hướng trên máy tính',
    desktopNavDesc: 'Trên máy tính, một thanh bên đầy đủ luôn hiển thị ở bên trái với tất cả các danh mục tính năng. Khu vực nhập trò chuyện được cố định ở dưới cùng của vùng nội dung chính, với bảng Agent Desk mở rộng phía trên.',
    sidebarTitle: 'Các mục menu thanh bên',
    sidebarItems: [
      { n: 'Chat', d: 'Trợ lý AI cho mọi thao tác' },
      { n: 'My Assets', d: 'Xem danh mục đầu tư, số dư và danh sách token' },
      { n: 'Quant', d: 'Danh mục sàn giao dịch đã kết nối & công cụ giao dịch' },
      { n: 'Bridge', d: 'Chuyển tài sản xuyên chuỗi' },
      { n: 'Earn', d: 'Chương trình staking và phần thưởng' },
      { n: 'Agent', d: 'Lưu trữ và tự động hóa AI agent' },
      { n: 'Vision Insight', d: 'Thông tin thị trường và phân tích AI' },
      { n: 'Disk', d: 'Lưu trữ đám mây được mã hóa' },
      { n: 'Nodes', d: 'Quản lý Vision Node' },
      { n: 'Referral', d: 'Mời bạn bè và nhận thưởng' },
      { n: 'Mint', d: 'Tạo token tùy chỉnh' },
      { n: 'Contacts', d: 'Quản lý danh bạ của bạn' },
      { n: 'Settings', d: 'Cài đặt tài khoản và bảo mật' },
    ],
    h3_1: 'Điều hướng trên di động',
    h3_2: 'Điều hướng trên máy tính',
    h3_3: 'Các mục menu thanh bên',
  },

  'chat-overview': {
    title: 'Giao diện AI Chat',
    desc: 'Vision AI là trợ lý thông minh của bạn cho mọi thao tác blockchain. Chỉ cần gõ hoặc nói để gửi token, kiểm tra số dư hoặc nhận câu trả lời.',
    features: [
      { t: 'Ngôn ngữ tự nhiên', d: 'Gõ các lệnh như "Gửi 100 VCN cho John" và AI sẽ xử lý luồng giao dịch' },
      { t: 'Đa ngôn ngữ', d: 'Hỗ trợ tiếng Hàn và tiếng Anh với tính năng tự động nhận diện ngôn ngữ' },
      { t: 'Nhận biết ngữ cảnh', d: 'AI ghi nhớ ngữ cảnh cuộc trò chuyện và có thể tham chiếu các thao tác trước đó' },
      { t: 'Gợi ý thông minh', d: 'Các nút thao tác nhanh xuất hiện trên màn hình chào mừng cho những thao tác phổ biến' },
    ],
    tip: 'AI Chat là màn hình mặc định sau khi đăng nhập. Bạn có thể truy cập tất cả các tính năng của ví thông qua lệnh ngôn ngữ tự nhiên mà không cần điều hướng qua các menu.',
  },
  'chat-quick': {
    title: 'Thao tác nhanh',
    desc: 'Các nút thao tác được định sẵn trên màn hình chào mừng để truy cập tức thì vào các tính năng phổ biến.',
    actions: [
      { n: 'Tìm hiểu về Vision Chain', d: 'Nhận tổng quan về hệ sinh thái Vision Chain', t: 'chat' },
      { n: 'Nhận quà VCN', d: 'Yêu cầu airdrop token VCN', t: 'chat' },
      { n: 'Mời bạn bè', d: 'Lấy liên kết giới thiệu và mời người khác', t: 'chat' },
      { n: 'Gửi VCN', d: 'Mở trực tiếp luồng Gửi', t: 'flow' },
    ],
    directFlow: 'Luồng trực tiếp',
    aiChat: 'AI Chat',
    note: 'Các thao tác nhanh có thể được quản trị viên cấu hình. Các nút hiển thị có thể thay đổi tùy theo các chiến dịch và khuyến mãi đang hoạt động.',
  },
  'chat-voice': {
    title: 'Nhập bằng giọng nói',
    desc: 'Dùng giọng nói của bạn để tương tác với Vision AI. Hỗ trợ tiếng Hàn và tiếng Anh với phiên âm theo thời gian thực.',
    steps: [
      { title: 'Nhấn vào Micro', desc: 'Trong khu vực nhập trò chuyện, nhấn biểu tượng micro để bắt đầu ghi âm.' },
      { title: 'Nói rõ ràng', desc: 'Nói lệnh của bạn bằng tiếng Hàn hoặc tiếng Anh. AI sẽ tự động nhận diện ngôn ngữ.' },
      { title: 'Kiểm tra & Gửi', desc: 'Văn bản được phiên âm sẽ xuất hiện trong ô nhập. Kiểm tra và nhấn gửi, hoặc chỉnh sửa trước khi gửi.' },
    ],
    tip: 'Nhập bằng giọng nói hỗ trợ khớp ngữ âm cho tên danh bạ. Bạn có thể nói "Gửi 100 VCN cho Sangkyun" và AI sẽ tìm danh bạ khớp gần nhất, ngay cả với các biến thể phát âm tiếng Hàn.',
  },
  'chat-intent': {
    title: 'Lệnh ý định AI',
    desc: 'AI hiểu các ý định bằng ngôn ngữ tự nhiên và có thể thực hiện các thao tác blockchain phức tạp.',
    tableHeaders: ['Ví dụ lệnh', 'Hành động'],
    commands: [
      { cmd: '"Gửi 100 VCN cho John"', act: 'Mở luồng gửi với người nhận và số tiền đã điền sẵn' },
      { cmd: '"Số dư của tôi là bao nhiêu?"', act: 'Hiển thị số dư VCN và ETH hiện tại của bạn' },
      { cmd: '"Bridge 50 VCN sang Ethereum"', act: 'Khởi tạo một giao dịch bridge xuyên chuỗi' },
      { cmd: '"Stake 200 VCN"', act: 'Điều hướng đến staking với số tiền đã điền sẵn' },
      { cmd: '"Hiển thị lịch sử giao dịch của tôi"', act: 'Hiển thị các giao dịch gần đây' },
      { cmd: '"Làm thế nào để mời bạn bè?"', act: 'Giải thích chương trình giới thiệu' },
      { cmd: '"Đi đến cài đặt"', act: 'Mở trang Cài đặt' },
    ],
  },
  'chat-history': {
    title: 'Lịch sử & Phiên trò chuyện',
    desc: 'Truy cập các cuộc trò chuyện trước đó và chuyển đổi giữa các phiên trò chuyện.',
    steps: [
      { title: 'Mở Lịch sử trò chuyện', desc: 'Trên di động, nhấn biểu tượng đồng hồ ở góc trên bên phải. Trên máy tính, bảng lịch sử nằm ở thanh bên.' },
      { title: 'Duyệt các phiên', desc: 'Xem tất cả các phiên trò chuyện trước đó được sắp xếp theo ngày. Mỗi phiên hiển thị tin nhắn đầu tiên làm tiêu đề.' },
      { title: 'Chuyển phiên', desc: 'Nhấn vào bất kỳ phiên nào để tải cuộc trò chuyện đó. Phiên hiện tại của bạn được tự động lưu.' },
      { title: 'Cuộc trò chuyện mới', desc: 'Nhấn "New Chat" để bắt đầu một cuộc trò chuyện mới. Các phiên trước đó vẫn có thể truy cập.' },
    ],
  },
  'chat-agent-desk': {
    title: 'Agent Desk',
    desc: 'Theo dõi các AI agent chạy nền và thao tác hàng loạt từ bảng Agent Desk phía trên ô nhập trò chuyện.',
    body: 'Agent Desk hiển thị tất cả các AI agent hiện đang hoạt động, các giao dịch đang chờ xử lý và tác vụ chạy nền. Mỗi thẻ agent hiển thị trạng thái, tiến độ, và cho phép bạn xem chi tiết hoặc loại bỏ các tác vụ đã hoàn thành.',
    statuses: [
      { s: 'Đang chạy', d: 'Agent đang tích cực thực hiện các thao tác' },
      { s: 'Đang chờ', d: 'Đang chờ người dùng phê duyệt hoặc blockchain xác nhận' },
      { s: 'Hoàn thành', d: 'Tác vụ đã hoàn thành thành công, có thể loại bỏ' },
      { s: 'Lỗi', d: 'Tác vụ thất bại, nhấn để xem chi tiết' },
    ],
  },
  'chat-tips': {
    title: 'Mẹo hằng ngày',
    desc: 'Thẻ "Bạn có biết?" trên màn hình chào mừng hiển thị các mẹo và thông tin hằng ngày về các tính năng của Vision Chain.',
    body: 'Một thẻ mẹo luân phiên xuất hiện ở đầu màn hình chào mừng. Điều hướng qua các mẹo bằng các nút mũi tên. Nhấn "GO" để chuyển đến tính năng liên quan được đề cập trong mẹo.',
    tip: 'Mẹo hằng ngày được quản trị viên cập nhật thường xuyên. Chúng bao gồm các tính năng mới, phương pháp hay nhất và tin tức hệ sinh thái.',
  },

  'send-basic': {
    title: 'Gửi token',
    desc: 'Gửi VCN, ETH hoặc các token được hỗ trợ khác đến bất kỳ địa chỉ ví hoặc danh bạ nào.',
    flowTitle: 'Luồng gửi',
    prerequisites: ['Đã hoàn tất thiết lập ví', 'Đủ số dư token cho giao dịch chuyển', 'Địa chỉ ví người nhận hoặc danh bạ đã lưu'],
    steps: [
      { title: 'Bắt đầu luồng gửi', desc: 'Nhấn "Send" từ trang Assets, dùng nút thao tác nhanh, hoặc gõ "Gửi" trong AI Chat.' },
      { title: 'Chọn token', desc: 'Chọn token bạn muốn gửi (VCN hoặc ETH).' },
      { title: 'Chọn người nhận', desc: 'Chọn một danh bạ từ danh sách của bạn, hoặc nhập địa chỉ ví thủ công.' },
      { title: 'Nhập số tiền', desc: 'Gõ số tiền cần gửi. Giá trị quy đổi USD được hiển thị theo thời gian thực.' },
      { title: 'Kiểm tra & Xác nhận', desc: 'Kiểm tra các chi tiết giao dịch bao gồm người nhận, số tiền và phí gas ước tính.' },
      { title: 'Nhập mật khẩu ví', desc: 'Nhập mật khẩu ví của bạn để ký và gửi giao dịch.' },
    ],
    warning: 'Luôn kiểm tra lại địa chỉ người nhận trước khi xác nhận. Các giao dịch blockchain không thể đảo ngược và không thể hoàn tiền.',
    tip: 'Bạn cũng có thể nói "Gửi 100 VCN cho John" trong AI Chat. AI sẽ tìm danh bạ khớp và điền sẵn chi tiết giao dịch cho bạn.',
  },
  'send-contact': {
    title: 'Chuyển dựa trên danh bạ',
    desc: 'Gửi token đến các danh bạ đã lưu bằng tên thay vì nhập địa chỉ ví thủ công.',
    body: 'Khi bạn bắt đầu luồng gửi, các danh bạ đã lưu của bạn sẽ xuất hiện để chọn nhanh. Bạn có thể tìm kiếm theo tên, và AI Chat cũng hỗ trợ khớp tên theo ngữ âm cho các lệnh giọng nói.',
    steps: [
      { title: 'Mở luồng gửi', desc: 'Bắt đầu một giao dịch gửi bằng bất kỳ phương thức nào (nút, trò chuyện hoặc thao tác nhanh).' },
      { title: 'Tìm kiếm danh bạ', desc: 'Gõ một tên vào ô người nhận để lọc danh bạ của bạn.' },
      { title: 'Chọn danh bạ', desc: 'Nhấn vào danh bạ để tự động điền địa chỉ ví của họ.' },
      { title: 'Tiếp tục', desc: 'Nhập số tiền và hoàn tất giao dịch như bình thường.' },
    ],
  },
  'send-scheduled': {
    title: 'Chuyển theo lịch (TimeLock)',
    desc: 'Lên lịch các giao dịch chuyển để thực hiện trong tương lai bằng cách sử dụng TimeLock Agent.',
    body: 'TimeLock Agent cho phép bạn lên lịch các giao dịch chuyển token tự động thực hiện sau một khoảng trễ được chỉ định. Điều này hữu ích cho các khoản thanh toán định kỳ, lịch trả dần (vesting) hoặc các giao dịch bị trì hoãn.',
    note: 'Các giao dịch chuyển theo lịch yêu cầu đủ số dư tại thời điểm thực hiện, chứ không phải tại thời điểm lên lịch.',
  },
  'send-batch': {
    title: 'Chuyển hàng loạt',
    desc: 'Gửi token đến nhiều người nhận cùng một lúc. Lý tưởng cho việc trả lương, airdrop hoặc phân phối cho cộng đồng.',
    steps: [
      { title: 'Chọn nhiều người nhận', desc: 'Trong luồng gửi, nhấn "Multi-send" để bật chế độ hàng loạt. Chọn các danh bạ hoặc nhập nhiều địa chỉ.' },
      { title: 'Đặt số tiền', desc: 'Nhập số tiền riêng cho từng người nhận, hoặc đặt một số tiền đồng nhất cho tất cả.' },
      { title: 'Kiểm tra lô', desc: 'Một bản tóm tắt hiển thị tất cả người nhận và số tiền. Kiểm tra cẩn thận trước khi xác nhận.' },
      { title: 'Thực hiện', desc: 'Xác nhận và ký giao dịch hàng loạt. Mỗi giao dịch chuyển được thực hiện tuần tự.' },
    ],
  },
  'receive-tokens': {
    title: 'Nhận token',
    desc: 'Chia sẻ địa chỉ ví hoặc mã QR của bạn để nhận token từ người khác.',
    steps: [
      { title: 'Đi đến Nhận', desc: 'Đi đến Assets > Receive, hoặc nói "Làm thế nào để nhận token?" trong AI Chat.' },
      { title: 'Sao chép địa chỉ', desc: 'Nhấn nút sao chép để sao chép địa chỉ ví của bạn vào bộ nhớ tạm.' },
      { title: 'Chia sẻ mã QR', desc: 'Hiển thị mã QR cho người gửi. Họ có thể quét bằng bất kỳ ví tương thích nào.' },
    ],
    tip: 'Địa chỉ ví của bạn giống nhau trên tất cả các mạng được hỗ trợ trên Vision Chain. Để nhận trên các chuỗi khác (Ethereum, Polygon), hãy dùng cùng địa chỉ đó.',
  },

  'assets-dashboard': {
    title: 'Bảng điều khiển danh mục đầu tư',
    desc: 'Xem toàn bộ danh mục đầu tư của bạn trong nháy mắt, bao gồm tổng giá trị, phân tích token và hoạt động gần đây.',
    body: 'Bảng điều khiển danh mục đầu tư là trung tâm chính để theo dõi tất cả các tài sản on-chain của bạn. Nó hiển thị tổng giá trị danh mục bằng USD, số dư của từng token và phân tích trực quan về các khoản nắm giữ.',
    items: [
      { n: 'Tổng giá trị', d: 'Tổng giá trị USD của tất cả token trên mọi chuỗi' },
      { n: 'Danh sách token', d: 'Số dư của từng token như VCN, ETH và các token khác với giá thời gian thực' },
      { n: 'Biến động giá', d: 'Phần trăm thay đổi trong 24 giờ cho mỗi token, hiển thị bằng màu xanh/đỏ' },
      { n: 'Thao tác nhanh', d: 'Các nút Send, Receive và Bridge để truy cập tức thì' },
    ],
  },
  'assets-tokens': {
    title: 'Danh sách token & Số dư',
    desc: 'Xem chi tiết tất cả token trong ví của bạn với giá thời gian thực.',
    body: 'Ví của bạn tự động phát hiện và hiển thị tất cả các token ERC-20 được giữ trong địa chỉ. Các token chính là VCN (token gốc của Vision Chain) và ETH (dùng cho phí gas trên các chuỗi tương thích Ethereum).',
    tableHeaders: ['Token', 'Mô tả', 'Công dụng'],
    tokens: [
      { t: 'VCN', d: 'Token gốc của Vision Chain', u: 'Giao dịch, staking, quản trị' },
      { t: 'ETH', d: 'Ethereum / token gas', u: 'Phí gas trên Ethereum/Sepolia' },
      { t: 'MATIC', d: 'Token mạng Polygon', u: 'Các thao tác xuyên chuỗi' },
    ],
  },
  'assets-multichain': {
    title: 'Số dư đa chuỗi',
    desc: 'Xem và quản lý tài sản trên các mạng Vision Chain, Ethereum Sepolia, Polygon và Base.',
    body: 'Ví Vision Chain hỗ trợ nhiều mạng blockchain. Địa chỉ ví của bạn hoạt động trên tất cả các chuỗi được hỗ trợ, và bạn có thể chuyển đổi giữa chúng để xem số dư trên từng mạng.',
    tip: 'Dùng Cross-Chain Bridge để di chuyển token giữa Vision Chain và Ethereum. Địa chỉ ví của bạn giữ nguyên trên tất cả các mạng.',
  },
  'assets-history': {
    title: 'Lịch sử giao dịch',
    desc: 'Xem tất cả các giao dịch trước đây bao gồm gửi, nhận, chuyển bridge và các thao tác staking.',
    body: 'Lịch sử giao dịch hiển thị một danh sách theo trình tự thời gian của tất cả hoạt động on-chain liên quan đến ví của bạn. Mỗi mục hiển thị loại giao dịch, số tiền, đối tác, dấu thời gian và trạng thái xác nhận.',
    statuses: [
      { s: 'Đã xác nhận', d: 'Giao dịch đã hoàn tất on-chain' },
      { s: 'Đang chờ', d: 'Đang chờ blockchain xác nhận' },
      { s: 'Thất bại', d: 'Giao dịch bị hoàn nguyên hoặc bị từ chối' },
    ],
  },

  'bridge-overview': {
    title: 'Tổng quan Cross-Chain Bridge',
    desc: 'Chuyển token giữa Vision Chain và Ethereum một cách an toàn bằng cách sử dụng Vision Bridge.',
    features: [
      { t: 'Hai chiều', d: 'Chuyển VCN giữa Vision Chain và Ethereum Sepolia theo cả hai hướng' },
      { t: 'An toàn', d: 'Xác thực TSS đa chữ ký (Threshold Signature Scheme) cho tất cả các giao dịch bridge' },
      { t: 'Chi phí thấp', d: 'Không phí gas ở phía Vision Chain. Chỉ áp dụng phí gas Ethereum cho các giao dịch chuyển ra ngoài' },
      { t: 'Nhanh', d: 'Các giao dịch bridge thường hoàn tất trong vòng 2-5 phút sau khi blockchain xác nhận' },
    ],
    warning: 'Các giao dịch bridge là xuyên chuỗi và có thể mất vài phút. Đừng đóng ứng dụng trong khi một giao dịch bridge đang diễn ra.',
  },
  'bridge-forward': {
    title: 'Từ Vision đến Ethereum',
    desc: 'Bridge token VCN từ Vision Chain sang Ethereum Sepolia.',
    prerequisites: ['Có số dư VCN trên Vision Chain', 'Đã kết nối với mạng Vision Chain'],
    steps: [
      { title: 'Mở Bridge', desc: 'Đi đến Bridge từ menu thanh bên, hoặc nói "Bridge" trong AI Chat.' },
      { title: 'Chọn hướng', desc: 'Chọn "Vision Chain -> Ethereum" làm hướng bridge.' },
      { title: 'Nhập số tiền', desc: 'Chỉ định số lượng VCN cần bridge. Giới hạn tối thiểu và tối đa được hiển thị.' },
      { title: 'Kiểm tra & Xác nhận', desc: 'Kiểm tra phí bridge, thời gian ước tính và đích đến. Xác nhận giao dịch.' },
      { title: 'Chờ xác nhận', desc: 'Bridge xử lý theo từng giai đoạn: khóa trên Vision Chain, xác thực qua TSS, phát hành (mint) trên Ethereum.' },
    ],
  },
  'bridge-reverse': {
    title: 'Từ Ethereum đến Vision',
    desc: 'Bridge token từ Ethereum trở lại Vision Chain.',
    prerequisites: ['Có số dư VCN trên Ethereum Sepolia', 'Có ETH để trả phí gas trên Ethereum'],
    steps: [
      { title: 'Mở Bridge', desc: 'Đi đến Bridge và chọn "Ethereum -> Vision Chain".' },
      { title: 'Nhập số tiền', desc: 'Chỉ định số tiền cần bridge trở lại Vision Chain.' },
      { title: 'Phê duyệt token', desc: 'Phê duyệt cho hợp đồng bridge được phép chi tiêu token của bạn (chỉ lần đầu tiên).' },
      { title: 'Xác nhận Bridge', desc: 'Ký giao dịch. Phí gas ETH áp dụng ở phía Ethereum.' },
      { title: 'Chờ hoàn tất', desc: 'Token được đốt (burn) trên Ethereum và mở khóa trên Vision Chain sau khi TSS xác thực.' },
    ],
  },
  'bridge-monitor': {
    title: 'Giám sát giao dịch Bridge',
    desc: 'Theo dõi trạng thái các giao dịch bridge của bạn theo thời gian thực.',
    body: 'Tất cả các giao dịch bridge được theo dõi bằng một chỉ báo tiến độ nhiều giai đoạn. Bạn có thể xem trạng thái của từng giai đoạn: gửi, xác nhận, xác thực TSS và hoàn tất.',
    note: 'Các giao dịch bridge được xử lý tự động. Nếu một giao dịch bridge có vẻ bị kẹt hơn 30 phút, hãy liên hệ bộ phận hỗ trợ kèm theo hash giao dịch của bạn.',
  },

  'staking-overview': {
    title: 'Tổng quan Staking',
    desc: 'Stake token VCN với tư cách là Bridge Validator để kiếm phần thưởng từ phí bridge và các quỹ trợ cấp. Tất cả các giao dịch staking đều không mất phí gas.',
    features: [
      { t: 'APY hằng năm 12-20%', d: 'Phần thưởng được tính toán động dựa trên tổng lượng stake của mạng, khối lượng bridge và số dư quỹ trợ cấp. APY thực tế được hiển thị theo thời gian thực trên trang staking.' },
      { t: 'Nguồn phần thưởng kép', d: 'Validator kiếm được từ hai quỹ: (1) Quỹ phí Bridge - 1% của mỗi giao dịch bridge, và (2) Quỹ trợ cấp - phần thưởng VCN bổ sung được phân phối theo thời gian.' },
      { t: 'Staking không phí gas', d: 'Tất cả các thao tác staking đều dùng hệ thống Vision Paymaster và chữ ký EIP-2612 Permit. Bạn không bao giờ trả phí gas - chỉ một khoản phí dịch vụ 1 VCN cho mỗi giao dịch stake.' },
      { t: 'Rủi ro Slashing 50%', d: 'Các validator gửi bằng chứng bridge không hợp lệ có thể mất 50% số tiền đã stake. Điều này bảo vệ tính toàn vẹn của các giao dịch xuyên chuỗi.' },
    ],
    dashboardStatsTitle: 'Thống kê bảng điều khiển',
    dashboardStatsDesc: 'Khi bạn mở trang Staking, một thanh thống kê ở trên cùng hiển thị các thông tin toàn mạng sau:',
    dashboardStats: [
      { n: 'Tổng đã stake', d: 'Tổng lượng VCN đã stake trên tất cả validator trên toàn mạng' },
      { n: 'Validator đang hoạt động', d: 'Số lượng validator hiện đang chạy và xác thực các giao dịch bridge (hiển thị bằng chỉ báo nhấp nháy màu xanh)' },
      { n: 'Stake tối thiểu', d: 'Số tiền tối thiểu cần thiết để trở thành validator: 100 VCN' },
      { n: 'Thời gian cooldown', d: 'Số ngày token của bạn bị khóa sau khi yêu cầu unstake: 7 ngày' },
      { n: 'Tỷ lệ Slash', d: 'Phần trăm stake có thể bị slash do bằng chứng không hợp lệ: 50% (hiển thị màu đỏ)' },
    ],
    balancePanelTitle: 'Bảng số dư Staking của bạn',
    balancePanelDesc: 'Bên dưới thanh thống kê, thông tin staking cá nhân của bạn được hiển thị trong một bảng được đánh dấu màu hổ phách:',
    balancePanel: [
      { n: 'Số dư VCN của bạn', d: 'Lượng VCN khả dụng trong ví của bạn có thể được stake' },
      { n: 'Số tiền đã stake của bạn', d: 'VCN hiện đang bị khóa trong hợp đồng staking (hiển thị màu hổ phách)' },
      { n: 'Unstake đang chờ', d: 'Nếu bạn đã yêu cầu unstake, hiển thị số tiền và thời gian còn lại (ví dụ: "còn lại 3 ngày 12 giờ")' },
      { n: 'Phần thưởng đang chờ', d: 'Phần thưởng VCN chưa nhận kèm phần trăm APY hiện tại. Nút "Claim" màu xanh xuất hiện bên cạnh số tiền' },
    ],
    h3_1: 'Thống kê bảng điều khiển',
  },
  'staking-how': {
    title: 'Cách stake VCN',
    desc: 'Hướng dẫn chi tiết từng bước để stake VCN với tư cách là Bridge Validator.',
    prerequisites: ['Tối thiểu 100 VCN trong ví của bạn (cộng thêm phí dịch vụ 1 VCN)', 'Đã thiết lập mật khẩu ví (dùng để ký EIP-712 Permit)', 'Đã đăng nhập vào ví Vision Chain'],
    steps: [
      { title: 'Mở trang Staking', desc: 'Từ menu thanh bên, nhấn "Earn" để đi đến trang Validator Staking. Trang hiển thị thống kê mạng, số dư của bạn và biểu mẫu staking.' },
      { title: 'Kiểm tra tab "Stake"', desc: 'Biểu mẫu staking có ba tab: Stake, Unstake và Withdraw. Hãy đảm bảo bạn đang ở tab "Stake" (được đánh dấu màu hổ phách). Nếu không, hãy nhấn vào đó để chuyển.' },
      { title: 'Nhập số tiền stake', desc: 'Gõ số lượng VCN bạn muốn stake vào ô nhập. Tối thiểu là 100 VCN (hiển thị dưới dạng văn bản gợi ý "Min: 100 VCN"). Bạn có thể nhấn nút "MAX" để stake toàn bộ số dư khả dụng.' },
      { title: 'Nhấp "Stake VCN"', desc: 'Nhấn nút "STAKE VCN" màu hổ phách ở dưới cùng biểu mẫu. Điều này bắt đầu quá trình staking.' },
      { title: 'Nhập mật khẩu ví', desc: 'Một cửa sổ bật lên có tiêu đề "Spending Password Required" xuất hiện. Nhập mật khẩu ví của bạn (mật khẩu bạn đã đặt khi thiết lập ví, không phải mật khẩu đăng nhập) và nhấn "Confirm".' },
      { title: 'Chờ ký EIP-712 Permit', desc: 'Nút đổi thành "Approving..." trong khi ví của bạn ký một permit dữ liệu có kiểu EIP-712. Đây là một chữ ký không phí gas cho phép Paymaster chuyển VCN (số tiền stake + phí 1 VCN) thay mặt bạn.' },
      { title: 'Xử lý giao dịch', desc: 'Sau khi ký, nút đổi thành "Staking..." trong khi Paymaster gửi giao dịch on-chain. Paymaster trả phí gas, bạn chỉ trả phí dịch vụ 1 VCN thông qua permit.' },
      { title: 'Xác nhận', desc: 'Khi thành công, một chỉ báo thành công màu xanh xuất hiện kèm hash giao dịch. "Số tiền đã stake của bạn" được cập nhật, số dư VCN của bạn giảm, và bạn hiện là Validator đang hoạt động. Phần thưởng bắt đầu tích lũy ngay lập tức.' },
    ],
    warning: 'Stake tối thiểu là 100 VCN. Nếu bạn cố stake ít hơn, một thông báo lỗi sẽ xuất hiện: "Minimum stake is 100 VCN". Mỗi giao dịch staking tính một khoản phí dịch vụ 1 VCN cho Paymaster.',
    tip: 'Sau khi stake, trạng thái của bạn đổi thành "Active Validator" và bạn bắt đầu kiếm phần thưởng tỷ lệ thuận với số tiền đã stake. Phần thưởng đến từ phí giao dịch bridge (1% mỗi lần chuyển bridge) và quỹ trợ cấp.',
  },
  'staking-rewards': {
    title: 'Phần thưởng, Unstaking & Rút tiền',
    desc: 'Hướng dẫn toàn diện về việc nhận phần thưởng, yêu cầu unstake và rút token của bạn.',
    claimingTitle: 'Nhận phần thưởng',
    claimingDesc: 'Phần thưởng tích lũy liên tục miễn là bạn là Validator đang hoạt động. Chúng hiển thị ở hàng "Pending Rewards" trong bảng số dư của bạn.',
    claimingSteps: [
      { title: 'Kiểm tra phần thưởng đang chờ', desc: 'Xem dòng "Pending Rewards" trong bảng số dư màu hổ phách. Nó hiển thị số lượng VCN chính xác với tối đa 4 chữ số thập phân, cùng với phần trăm APY hiện tại.' },
      { title: 'Nhấn "Claim"', desc: 'Nút "Claim" màu xanh xuất hiện bên cạnh phần thưởng đang chờ của bạn. Nhấn để nhận. Nút bị vô hiệu hóa (làm mờ) nếu bạn không có phần thưởng nào để nhận.' },
      { title: 'Xử lý giao dịch', desc: 'Giao dịch nhận được gửi qua Paymaster (không phí gas). Nút hiển thị một vòng xoay trong khi xử lý.' },
      { title: 'Phần thưởng được thêm vào số dư', desc: 'Khi thành công, số dư ví VCN của bạn tăng lên theo số tiền đã nhận. Bộ đếm phần thưởng đang chờ được đặt lại về 0 và bắt đầu tích lũy lại ngay lập tức.' },
    ],
    claimingTip: 'Nhận phần thưởng là không phí gas và không có phí. Bạn có thể nhận thường xuyên tùy ý, nhưng vì mỗi lần nhận là một giao dịch, nên để phần thưởng tích lũy trước khi nhận là thực tế hơn.',
    unstakeTitle: 'Yêu cầu Unstake',
    unstakeDesc: 'Unstaking là một quy trình hai bước: trước tiên bạn yêu cầu unstake (bắt đầu thời gian cooldown 7 ngày), sau đó bạn rút tiền sau khi hết thời gian cooldown.',
    unstakeSteps: [
      { title: 'Chuyển sang tab "Unstake"', desc: 'Trong biểu mẫu staking, nhấn tab "Unstake". Nhãn hiển thị số tiền tối đa bạn có thể unstake (ví dụ: "Unstake Amount (Max: 1,000 VCN)").' },
      { title: 'Nhập số tiền unstake', desc: 'Gõ số tiền cần unstake. Bạn có thể nhấn "MAX" để unstake toàn bộ. Quan trọng: nếu bạn unstake một phần, số tiền còn lại phải bằng 0 hoặc ít nhất 100 VCN (mức stake tối thiểu). Nếu không, bạn sẽ thấy lỗi: "Remaining stake would be below minimum 100 VCN."' },
      { title: 'Nhấn "Request Unstake"', desc: 'Nhấn nút màu hổ phách. Giao dịch được gửi qua Paymaster (không phí gas).' },
      { title: 'Bắt đầu Cooldown', desc: 'Khi thành công, một hàng "Pending Unstake" mới xuất hiện trong bảng số dư của bạn, hiển thị số tiền và một bộ đếm ngược (ví dụ: "còn lại 7 ngày 0 giờ"). Số tiền đã stake của bạn giảm tương ứng.' },
    ],
    unstakeWarning: 'Trong thời gian cooldown 7 ngày, các token đang unstake của bạn KHÔNG kiếm phần thưởng. Bạn không thể hủy một yêu cầu unstake. Hãy chắc chắn rằng bạn sẵn sàng chờ đợi trước khi tiếp tục.',
    unstakeNote: 'Nếu bạn unstake toàn bộ số dư, bạn sẽ không còn là Validator đang hoạt động và sẽ ngừng kiếm phần thưởng. Bạn có thể stake lại bất cứ lúc nào với mức tối thiểu 100 VCN.',
    withdrawTitle: 'Rút tiền sau Cooldown',
    withdrawDesc: 'Sau khi thời gian cooldown 7 ngày hoàn tất, một tab thứ ba "Withdraw" xuất hiện trong biểu mẫu staking.',
    withdrawSteps: [
      { title: 'Chờ Cooldown', desc: 'Theo dõi bộ đếm ngược ở hàng "Pending Unstake". Khi nó đổi thành "Ready to withdraw", thời gian 7 ngày đã hoàn tất.' },
      { title: 'Chuyển sang tab "Withdraw"', desc: 'Một tab "Withdraw" màu xanh tự động xuất hiện trong các tab của biểu mẫu khi cooldown của bạn hoàn tất. Nhấn vào đó.' },
      { title: 'Nhấn "Withdraw"', desc: 'Nhấn nút "WITHDRAW" màu xanh. Paymaster xử lý việc rút tiền không phí gas.' },
      { title: 'Token được trả về', desc: 'Số dư VCN của bạn tăng lên theo số tiền đã rút. Hàng "Pending Unstake" biến mất. Quá trình hoàn tất.' },
    ],
    validatorTableTitle: 'Bảng Validator',
    validatorTableDesc: 'Ở cuối trang, một bảng hiển thị top 5 validator đang hoạt động với địa chỉ được rút gọn và số tiền đã stake của họ. Điều này giúp bạn hình dung về phân bố validator của mạng.',
    tip: 'Nhận phần thưởng là không phí gas và không có phí. Bạn có thể nhận thường xuyên tùy ý, nhưng để thực tế thì nên tích lũy phần thưởng rồi mới nhận.',
    body2: 'Unstaking là một quy trình hai bước: trước tiên bạn yêu cầu unstake để bắt đầu cooldown 7 ngày, sau đó rút tiền.',
    warning: 'Trong thời gian cooldown 7 ngày, các token đang unstake không nhận phần thưởng. Yêu cầu unstake không thể hủy. Hãy chắc chắn rằng bạn đã sẵn sàng trước khi tiếp tục.',
    note: 'Nếu unstake toàn bộ, bạn sẽ bị loại khỏi danh sách validator đang hoạt động và phần thưởng sẽ dừng lại. Bạn có thể stake lại bất cứ lúc nào với mức tối thiểu 100 VCN.',
    body: 'Ở cuối trang hiển thị địa chỉ và số tiền staking của top 5 validator đang hoạt động. Bạn có thể nắm được phân bố validator của mạng.',
    h3_1: 'Nhận phần thưởng',
    h3_2: 'Yêu cầu Unstake',
    h3_3: 'Rút tiền sau Cooldown',
    h3_4: 'Bảng Validator',
  },

  'agent-overview': {
    title: 'Lưu trữ AI agent là gì?',
    desc: 'Lưu trữ AI agent triển khai các bot AI tự động trên Vision Chain để thực hiện thay bạn nhiều tác vụ khác nhau, từ chuyển tiền tự động đến tạo nội dung mạng xã hội.',
    features: [
      { t: '7 hành động on-chain', d: 'Giám sát số dư, chuyển tự động, staking tự động, unstaking có điều kiện, giám sát mạng, bảng điều khiển staking, theo dõi bảng xếp hạng' },
      { t: '5 hành động tăng trưởng', d: 'Quảng bá giới thiệu, quảng bá mạng xã hội, sáng tạo nội dung, phân phối lời mời, tương tác cộng đồng' },
      { t: 'Các bậc chi phí', d: 'Chỉ đọc (0.05 VCN), trung bình (0.1 VCN), ghi (0.5 VCN) cho mỗi lần thực thi' },
      { t: 'Lập lịch linh hoạt', d: 'Chạy agent theo khoảng 5 phút/30 phút/1 giờ/1 ngày' },
    ],
    body: 'Mỗi agent nhận một địa chỉ ví riêng, khóa API và số dư VCN. Nó được cung cấp bởi bộ định tuyến ZYNK AI (mô hình DeepSeek) và chạy theo khoảng thời gian bạn thiết lập. Khi tạo agent, bạn nhận Điểm thưởng (RP).',
    body2: 'Trang agent có ba tab ở trên cùng:',
    h3_1: 'Tab bảng điều khiển Agent',
  },
  'agent-create': {
    title: 'Tạo Agent',
    desc: 'Hướng dẫn từng bước thông qua trình tạo agent 4 bước.',
    prerequisites: ['Đã đăng nhập vào ví Vision Chain', 'Chưa có agent nào (ban đầu 1 agent cho mỗi tài khoản)'],
    steps: [
      { title: 'Mở Lưu trữ Agent', desc: 'Từ menu thanh bên, nhấn "Agent".' },
      { title: 'Nhấp "Tạo agent đầu tiên"', desc: 'Nếu bạn chưa có agent nào, nút "Tạo agent đầu tiên" sẽ hiển thị ở trạng thái trống.' },
      { title: 'Nhập tên agent', desc: 'Nhập một tên agent duy nhất (ví dụ: "Trình giám sát số dư", "Trình staking tự động").' },
      { title: 'Nhấp "Đăng ký và tiếp tục"', desc: 'Agent nhận một địa chỉ ví riêng và số dư ban đầu 100 VCN.' },
    ],
    tip: 'Khi tạo agent đầu tiên, bạn nhận Điểm thưởng (RP). Số điểm do quản trị viên thiết lập.',
    warning: 'Agent sử dụng VCN thật từ ví riêng của nó. Hãy bắt đầu với thiết lập thận trọng (khoảng thời gian dài, hạn mức thấp) và theo dõi nhật ký thực thi trước khi tăng tần suất hoặc ngân sách.',
    body2: 'Một lưới các thẻ hành động được sắp xếp theo danh mục sẽ xuất hiện. Mỗi thẻ hiển thị tên hành động, mô tả, huy hiệu bậc chi phí (xanh/hổ phách/đỏ) và chi phí VCN cho mỗi lần thực thi.',
    h3_1: 'Bước 1: Đặt tên Agent',
    h3_2: 'Bước 2: Chọn hành động',
    h3_3: 'Bước 3: Cấu hình thiết lập hành động',
    h3_4: 'Bước 4: Lập lịch và triển khai',
  },
  'agent-actions': {
    title: 'Các loại hành động khả dụng',
    desc: 'Tham chiếu đầy đủ về chi phí, thiết lập và các trường hợp sử dụng của tất cả 12 hành động agent.',
    h3_1: 'Hành động on-chain (7)',
    h3_2: 'Hành động tăng trưởng (5)',
  },
  'agent-manage': {
    title: 'Quản lý Agent',
    desc: 'Hướng dẫn chi tiết về bảng điều khiển tổng quan agent -- giám sát trạng thái, chuyển đổi, xóa.',
    steps: [
      { title: 'Tạm dừng / Tiếp tục', desc: 'Nhấn nút phát/tạm dừng trên thẻ agent. Khi tạm dừng, cấu hình và số dư được giữ nguyên.' },
      { title: 'Xóa Agent', desc: 'Nhấn biểu tượng thùng rác. Một hộp thoại xác nhận sẽ xuất hiện. Việc xóa là vĩnh viễn và không thể hoàn tác.' },
      { title: 'Nạp số dư', desc: 'Chuyển VCN đến địa chỉ ví của agent. Nếu không có VCN, agent sẽ ngừng thực thi.' },
    ],
    warning: 'Việc xóa agent là vĩnh viễn và không thể hoàn tác. Hãy chuyển số VCN còn lại trong ví agent trước khi xóa. Khóa API bị vô hiệu hóa ngay lập tức.',
    body2: 'Trong tab tổng quan, mỗi agent đã đăng ký được hiển thị dưới dạng thẻ với các thông tin sau:',
    h3_1: 'Điều khiển Agent',
  },
  'agent-logs': {
    title: 'Nhật ký thực thi & Giám sát',
    desc: 'Hiểu hoạt động của agent thông qua các nhật ký thực thi chi tiết.',
    steps: [
      { title: 'Kiểm tra nhật ký sau lần chạy đầu tiên', desc: 'Sau khi triển khai, hãy chờ khoảng thời gian chạy đầu tiên rồi kiểm tra nhật ký.' },
      { title: 'Chú ý các mẫu lỗi', desc: 'Nếu bạn thấy lỗi lặp lại (dấu X đỏ), có thể thiết lập bị sai hoặc số dư không đủ.' },
      { title: 'Giám sát tốc độ tiêu thụ VCN', desc: 'So sánh "Tổng VCN đã dùng" với ngân sách của bạn. Nếu chi tiêu quá cao, hãy điều chỉnh khoảng thời gian.' },
      { title: 'Xem xét nội dung được tạo', desc: 'Đối với các hành động tăng trưởng, hãy xem xét chất lượng và độ chính xác của nội dung được tạo trước khi chia sẻ.' },
    ],
    tip: 'Nếu agent hiển thị trạng thái "Số dư không đủ", nghĩa là ví của agent đã hết VCN. Hãy chuyển thêm VCN đến địa chỉ ví của agent và tiếp tục agent.',
    body2: 'Chuyển sang tab "Nhật ký" trên trang agent để xem lịch sử thực thi. Nhật ký được tải từ API cổng agent và hiển thị 50 lần thực thi gần nhất.',
    h3_1: 'Các trường của mục nhật ký',
    h3_2: 'Phương pháp giám sát tốt nhất',
  },

  'insight-overview': {
    title: 'Bảng điều khiển Vision Insight',
    desc: 'Thông tin thị trường được AI tuyển chọn, nơi Gemini AI thu thập tin tức từ hơn 10 nguồn và cung cấp phân tích cảm xúc theo thời gian thực.',
    body: 'Vision Insight thu thập tin tức tiền mã hóa mỗi 2 giờ từ CoinDesk, CoinTelegraph, Bitcoin Magazine, Decrypt, The Block, các hãng truyền thông Hàn Quốc (Decenter, BlockMedia) và nhiều nguồn khác. Mọi bài viết đều được Gemini AI phân tích cảm xúc, điểm ảnh hưởng và danh mục.',
    tip: 'Nhấn nút "API" ở góc trên bên phải để chuyển sang chế độ xem luồng dữ liệu agent, nơi bạn có thể xem dữ liệu JSON gốc mà các AI agent có thể sử dụng theo cách lập trình.',
    h3_1: 'Các thành phần của bảng điều khiển',
  },
  'insight-news': {
    title: 'Đọc bảng tin',
    desc: 'Hướng dẫn từng bước để duyệt và sử dụng bảng tin được AI tuyển chọn.',
    note: 'Bài viết được thu thập mỗi 2 giờ. Nếu một danh mục hiển thị "Chưa có bài viết nào trong danh mục này", nghĩa là việc thu thập dữ liệu đang được tiến hành.',
  },
  'insight-signals': {
    title: 'Bản tin thị trường AI & Tín hiệu giao dịch',
    desc: 'Hiểu về phân tích thị trường và tín hiệu giao dịch do Gemini AI tạo ra.',
    body2: 'Bản tin thị trường AI là cốt lõi của Vision Insight. Nó được Gemini AI tạo ra bằng cách phân tích tất cả các bài viết đã thu thập và dữ liệu thị trường.',
    warning: 'Bản tin thị trường AI và tín hiệu giao dịch chỉ nhằm mục đích cung cấp thông tin và không phải là lời khuyên tài chính. Luôn tự nghiên cứu trước khi đưa ra các quyết định đầu tư. Độ chính xác của phân tích AI trong quá khứ không đảm bảo kết quả trong tương lai.',
  },

  'cex-connect': {
    title: 'Kết nối sàn giao dịch',
    desc: 'Kết nối tài khoản sàn giao dịch tập trung của bạn với Vision Chain bằng thông tin xác thực API. Hỗ trợ 15 sàn giao dịch tại các thị trường Hàn Quốc, Nhật Bản, Mỹ và toàn cầu.',
    steps: [
      { title: 'Mở trang Quant', desc: 'Nhấn "Quant" ở thanh bên.' },
      { title: 'Nhấp "Kết nối sàn giao dịch"', desc: 'Chọn một sàn giao dịch từ danh sách.' },
      { title: 'Nhập thông tin xác thực API', desc: 'Nhập khóa API và secret. Một số sàn giao dịch yêu cầu passphrase bổ sung.' },
      { title: 'Xác minh kết nối', desc: 'Hệ thống xác thực thông tin của bạn. Khi thành công, dữ liệu danh mục được đồng bộ.' },
    ],
    warning: 'Chỉ dùng khóa API chỉ đọc. Đừng kích hoạt quyền giao dịch, rút tiền hoặc chuyển tiền. Vision Chain chỉ đọc dữ liệu số dư và giá.',
    body2: 'Hầu hết các sàn giao dịch yêu cầu (hoặc khuyến nghị mạnh mẽ) giới hạn quyền truy cập API vào các địa chỉ IP cụ thể. Vision Chain cung cấp một IP máy chủ cố định cho mục đích này.',
  },
  'cex-exchanges': {
    title: 'Các sàn giao dịch được hỗ trợ',
    desc: 'Vision Chain hỗ trợ 15 sàn giao dịch tập trung tại các thị trường Hàn Quốc, Nhật Bản, Mỹ và toàn cầu.',
    tip: 'Bạn có thể kết nối nhiều sàn giao dịch cùng lúc. Các tài sản cùng ký hiệu được tổng hợp thành một hàng kèm huy hiệu sàn giao dịch nguồn.',
  },
  'cex-portfolio': {
    title: 'Tổng quan danh mục đầu tư',
    desc: 'Xem hợp nhất tất cả các khoản nắm giữ tiền mã hóa từ các sàn giao dịch đã kết nối, kèm theo định giá thời gian thực, biểu đồ và theo dõi lãi/lỗ.',
    body2: 'Khi bạn kết nối một hoặc nhiều sàn giao dịch, bảng điều khiển danh mục sẽ hiển thị làm chế độ xem mặc định. Nó bao gồm ba phần chính: các thẻ tóm tắt, biểu đồ phân bổ tài sản và danh sách tài sản.',
    tip: 'Hãy đồng bộ danh mục của bạn thường xuyên. Vì hệ thống so sánh các ảnh chụp danh mục để tính lãi/lỗ, nên bạn đồng bộ càng thường xuyên thì việc theo dõi hiệu suất càng chính xác.',
  },
  'cex-quant': {
    title: 'Quant Engine - Thiết lập chiến lược',
    desc: 'Thiết lập và triển khai các chiến lược giao dịch tự động trên các sàn giao dịch đã kết nối. Cung cấp 6 mẫu chiến lược dựa trên nghiên cứu.',
    note: 'Quant Engine hiện đang trong giai đoạn beta. Để truy cập các tính năng Quant, hãy kết nối một hoặc nhiều sàn giao dịch trên trang Quant.',
    body2: 'Mỗi chiến lược có các tham số có thể điều chỉnh, được tổ chức thành 4 nhóm. Bạn có thể điều chỉnh chúng khi triển khai hoặc chỉnh sửa một agent chiến lược.',
    warning: 'Các chiến lược Quant đi kèm rủi ro thị trường. Hiệu suất trong quá khứ và lợi nhuận trung bình 30 ngày hiển thị trên thẻ chiến lược không đảm bảo kết quả trong tương lai. Luôn bắt đầu với thiết lập thận trọng và vị thế nhỏ.',
  },
  'cex-security': {
    title: 'Bảo mật & Danh sách trắng IP',
    desc: 'Cách bảo vệ thông tin xác thực API sàn giao dịch, kiến trúc luồng dữ liệu và các phương pháp hay nhất để sử dụng API an toàn.',
    body2: 'Hiểu cách thông tin xác thực API được xử lý ở từng bước:',
    h3_1: 'Kiến trúc luồng dữ liệu',
  },

  'disk-overview': {
    title: 'Vision Disk - Lưu trữ đám mây được mã hóa',
    desc: 'Lưu trữ, chia sẻ và quản lý tệp với mã hóa đầu cuối được cung cấp bởi khóa riêng của ví và thanh toán không phí gas EIP-2612.',
    body: 'Vision Disk mã hóa tệp bằng mã hóa AES-GCM với khóa được dẫn xuất từ khóa riêng của ví, cục bộ trong trình duyệt của bạn. Dữ liệu được mã hóa được lưu trữ trên Vision Cloud và siêu dữ liệu tệp được neo trên chuỗi. Chỉ bạn mới có thể giải mã tệp của mình.',
  },
  'disk-upload': {
    title: 'Tải lên & Tải xuống tệp',
    desc: 'Hướng dẫn từng bước để tải lên tệp đã mã hóa và tải xuống trên mọi thiết bị.',
    steps: [
      { title: 'Mở Vision Disk', desc: 'Nhấn "Disk" ở thanh bên.' },
      { title: 'Chọn tệp', desc: 'Nhấp nút "Tải lên" và chọn một tệp.' },
      { title: 'Xác nhận mã hóa', desc: 'Tệp được tự động mã hóa và tải lên.' },
      { title: 'Tải xuống', desc: 'Nhấp vào tệp để giải mã rồi tải xuống.' },
    ],
  },
  'disk-folders': {
    title: 'Quản lý thư mục & tệp',
    desc: 'Hướng dẫn đầy đủ để sắp xếp tệp bằng thư mục, thao tác hàng loạt và menu ngữ cảnh.',
  },
  'disk-share': {
    title: 'Chia sẻ & Xuất bản tệp',
    desc: 'Chia sẻ tệp với những người dùng cụ thể hoặc làm cho tệp có thể truy cập công khai. Đối với các tệp đã mã hóa, mật khẩu được tự động chuyển cho người nhận.',
  },
  'disk-encryption': {
    title: 'Mã hóa & Passkey (Xác thực sinh trắc học)',
    desc: 'Vision Disk sử dụng mã hóa AES-GCM. Với tích hợp Passkey, bạn có thể mở khóa các tệp đã mã hóa bằng vân tay hoặc Face ID.',
    h3_1: 'Cách mã hóa hoạt động',
  },
  'disk-ai-memory': {
    title: 'Bộ nhớ AI & Lập chỉ mục',
    desc: 'Vision Disk đóng vai trò là lớp bộ nhớ bền vững cho AI. Mọi tệp được tải lên đều được làm giàu bằng siêu dữ liệu có cấu trúc để AI có thể tìm kiếm và suy luận về dữ liệu cá nhân của bạn.',
  },
  'disk-chatbot': {
    title: 'Chia sẻ tệp qua AI Chat',
    desc: 'Sử dụng chatbot AI để tìm kiếm các tệp trên disk và chia sẻ chúng với những người dùng khác bằng lệnh ngôn ngữ tự nhiên.',
  },
  'disk-plans': {
    title: 'Gói đăng ký lưu trữ',
    desc: 'Chọn một gói lưu trữ thanh toán bằng token VCN thông qua chữ ký EIP-2612 Permit không phí gas.',
  },

  'nodes-overview': {
    title: 'Tổng quan Vision Node',
    desc: 'Chạy một Vision Node để hỗ trợ mạng, xác thực giao dịch và kiếm phần thưởng VCN + RP.',
  },
  'nodes-purchase': {
    title: 'Mua Node',
    desc: 'Hướng dẫn từng bước để mua bậc node Validator hoặc Enterprise.',
  },
  'nodes-install': {
    title: 'Hướng dẫn cài đặt',
    desc: 'Cài đặt ứng dụng máy tính Vision Node hoặc chạy bằng CLI trên máy chủ.',
  },

  'mint-overview': {
    title: 'Mint Studio',
    desc: 'Tạo và triển khai các token ERC-20 tùy chỉnh bằng trình hướng dẫn no-code trên Vision Chain và các mạng được hỗ trợ khác.',
  },
  'mint-create': {
    title: 'Tạo Token',
    desc: 'Hướng dẫn từng bước thông qua trình tạo token của Mint Studio.',
  },

  'contacts-manage': {
    title: 'Quản lý danh bạ',
    desc: 'Lưu, chỉnh sửa và sắp xếp các địa chỉ ví thường dùng bằng tìm kiếm giọng nói và tra cứu VNS.',
  },
  'referral-program': {
    title: 'Chương trình giới thiệu & Tiếp thị',
    desc: 'Hướng dẫn đầy đủ về hệ thống giới thiệu -- liên kết, cấp độ, phần thưởng trực tiếp/gián tiếp, vòng hằng ngày, bảng xếp hạng Referral Rush.',
  },
  'quest-campaign': {
    title: 'Hệ thống Điểm thưởng (RP)',
    desc: 'Hướng dẫn đầy đủ để kiếm, theo dõi và sử dụng Điểm thưởng từ mọi hoạt động trên Vision Chain.',
    h3_3: 'Bảng điều khiển RP',
  },

  'settings-profile': {
    title: 'Quản lý hồ sơ',
    desc: 'Cập nhật tên hiển thị, email và ảnh hồ sơ của bạn.',
  },
  'settings-2fa': {
    title: 'Thiết lập 2FA (Xác thực hai yếu tố)',
    desc: 'Thêm một lớp bảo mật bằng xác thực hai yếu tố dựa trên TOTP.',
    steps: [
      { title: 'Mở Cài đặt > Bảo mật', desc: 'Nhấn "Settings" ở thanh bên và đi đến tab Bảo mật.' },
      { title: 'Bật công tắc 2FA', desc: 'Bật công tắc "Kích hoạt 2FA".' },
      { title: 'Quét mã QR', desc: 'Quét mã QR bằng ứng dụng xác thực (như Google Authenticator).' },
      { title: 'Nhập mã xác thực', desc: 'Nhập mã 6 chữ số được tạo bởi ứng dụng.' },
      { title: 'Lưu mã dự phòng', desc: 'Lưu trữ an toàn các mã dự phòng được hiển thị. Dùng chúng nếu bạn mất thiết bị xác thực.' },
    ],
    warning: 'Nếu bạn không lưu trữ an toàn các mã dự phòng, bạn sẽ không thể truy cập tài khoản nếu mất thiết bị xác thực.',
  },
  'settings-backup': {
    title: 'Sao lưu & Khôi phục ví',
    desc: 'Sao lưu ví của bạn bằng cụm từ khôi phục hoặc đồng bộ đám mây, và khôi phục trên một thiết bị mới.',
  },
  'settings-language': {
    title: 'Cài đặt ngôn ngữ',
    desc: 'Chuyển đổi ngôn ngữ ứng dụng giữa tiếng Hàn và tiếng Anh.',
  },
  'settings-notifications': {
    title: 'Cài đặt thông báo',
    desc: 'Cấu hình các tùy chọn thông báo trong ứng dụng và qua email.',
  },

  'faq-login': {
    title: 'Sự cố đăng nhập',
    desc: 'Cách khắc phục các sự cố đăng nhập thường gặp.',
  },
  'faq-tx': {
    title: 'Giao dịch thất bại',
    desc: 'Các sự cố giao dịch thường gặp và cách khắc phục.',
  },
  'faq-bridge': {
    title: 'Sự cố Bridge',
    desc: 'Cách khắc phục các sự cố cross-chain bridge.',
  },
  'faq-contact': {
    title: 'Hỗ trợ khách hàng',
    desc: 'Nhận trợ giúp từ đội ngũ hỗ trợ Vision Chain.',
  },

  'feedback-overview': {
    title: 'Hệ thống phản hồi',
    desc: 'Vision AI cung cấp một hệ thống phản hồi thông minh, nơi bạn có thể gửi báo cáo lỗi, đề xuất tính năng và đề xuất kinh doanh thông qua cuộc trò chuyện tự nhiên.',
    body: 'Hệ thống phản hồi của Vision AI xử lý ba loại phản hồi:',
    h3_1: 'Cách hoạt động',
  },
  'feedback-bugs': {
    title: 'Báo cáo lỗi',
    desc: 'Báo cáo các sự cố gặp phải khi sử dụng Vision Chain. AI tự động phân loại vấn đề, đánh giá mức độ nghiêm trọng và chuyển đến đội ngũ phát triển.',
  },
  'feedback-features': {
    title: 'Đề xuất tính năng',
    desc: 'Chia sẻ ý tưởng của bạn về các tính năng mới hoặc cải tiến. Các yêu cầu tương tự từ nhiều người dùng được tự động nhóm lại, và các tính năng được yêu cầu nhiều nhất sẽ được xem xét trước.',
  },
  'feedback-business': {
    title: 'Đề xuất kinh doanh',
    desc: 'Gửi trực tiếp các đề xuất hợp tác, niêm yết, cộng tác hoặc tiếp thị thông qua chatbot.',
  },
  'feedback-tips': {
    title: 'Mẹo để phản hồi hiệu quả',
    desc: 'Làm theo các phương pháp hay nhất này để tận dụng tối đa hệ thống phản hồi.',
  },
};
