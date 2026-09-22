export type Language = 'en' | 'vi'

export const translations = {
  'nav.brand': { en: "Sun's Kitchen", vi: "Sun's Kitchen" },
  'nav.search': { en: 'Search', vi: 'Tìm kiếm' },
  'nav.favorites': { en: 'Favorites', vi: 'Yêu thích' },
  'nav.history': { en: 'History', vi: 'Lịch sử' },
  'nav.preferences': { en: 'Preferences', vi: 'Tùy chọn' },
  'nav.admin': { en: 'Admin', vi: 'Quản trị' },
  'nav.signOut': { en: 'Sign out', vi: 'Đăng xuất' },
  'nav.signIn': { en: 'Sign in', vi: 'Đăng nhập' },

  'common.any': { en: 'Any', vi: 'Bất kỳ' },

  'nav.language': { en: 'Language', vi: 'Ngôn ngữ' },
  'nav.recipeSource': { en: 'Recipe service', vi: 'Dịch vụ công thức' },
  'mode.catalog': { en: 'API', vi: 'API' },
  'mode.ai': { en: 'AI', vi: 'AI' },
  'mode.aiBadge': { en: 'AI-generated recipe', vi: 'Công thức do AI tạo' },

  'usage.limitTitle': { en: "That's today's limit", vi: 'Đã đạt giới hạn hôm nay' },
  'usage.limitMessage': {
    en: "You've reached today's limit of 5 recipes. It resets tomorrow.",
    vi: 'Bạn đã đạt giới hạn 5 công thức trong hôm nay. Giới hạn sẽ được làm mới vào ngày mai.',
  },
  'usage.limitClose': { en: 'Got it', vi: 'Đã hiểu' },
  'usage.remaining': {
    en: 'You have {remaining} of {limit} recipes left today.',
    vi: 'Bạn còn {remaining}/{limit} công thức cho hôm nay.',
  },
  'usage.contactMessage': {
    en: 'Contact {email} for more support.',
    vi: 'Liên hệ {email} để được hỗ trợ thêm.',
  },

  'home.title': { en: 'What should I cook?', vi: 'Hôm nay nấu gì?' },
  'home.subtitle': {
    en: "Tell us what you have or how you feel, and we'll suggest a dish.",
    vi: 'Cho chúng tôi biết bạn có gì hoặc bạn cảm thấy thế nào, chúng tôi sẽ gợi ý một món ăn.',
  },
  'home.ingredientsLabel': {
    en: 'Ingredients on hand (comma separated)',
    vi: 'Nguyên liệu có sẵn (cách nhau bằng dấu phẩy)',
  },
  'home.ingredientsPlaceholder': { en: 'chicken, rice, broccoli', vi: 'gà, cơm, bông cải xanh' },
  'home.moodLabel': { en: 'Mood (optional)', vi: 'Tâm trạng (tùy chọn)' },
  'home.moodPlaceholder': { en: 'comforting, light, spicy...', vi: 'ấm áp, nhẹ nhàng, cay...' },
  'home.timeLabel': {
    en: 'Time available in minutes (optional)',
    vi: 'Thời gian có sẵn, phút (tùy chọn)',
  },
  'home.cuisineLabel': { en: 'Cuisine (optional)', vi: 'Ẩm thực (tùy chọn)' },
  'home.categoryLabel': { en: 'Category (optional)', vi: 'Danh mục (tùy chọn)' },
  'home.mealTimeLabel': { en: 'Meal time (optional)', vi: 'Bữa ăn (tùy chọn)' },
  'home.submitting': { en: 'Thinking...', vi: 'Đang suy nghĩ...' },
  'home.submit': { en: 'Suggest a dish', vi: 'Gợi ý món ăn' },
  'home.viewRecipe': { en: 'View recipe', vi: 'Xem công thức' },

  'home.randomTitle': { en: 'Feeling lucky?', vi: 'Muốn thử vận may?' },
  'home.randomSubtitle': {
    en: 'Get a completely random dish, optionally from a specific cuisine.',
    vi: 'Nhận một món ăn ngẫu nhiên, có thể chọn theo một nền ẩm thực cụ thể.',
  },
  'home.randomButton': { en: '🎲 Random dish', vi: '🎲 Món ăn ngẫu nhiên' },
  'home.randomLoading': { en: 'Picking something...', vi: 'Đang chọn món...' },
  'home.usingPreferences': {
    en: 'Use my saved preferences',
    vi: 'Dùng tùy chọn đã lưu của tôi',
  },
  'home.editPreferencesLink': { en: 'Edit', vi: 'Chỉnh sửa' },

  'search.title': { en: 'Search recipes', vi: 'Tìm công thức nấu ăn' },
  'search.placeholder': { en: 'pasta, tacos, salad...', vi: 'mì Ý, tacos, salad...' },
  'search.submit': { en: 'Search', vi: 'Tìm kiếm' },
  'search.loading': { en: 'Searching...', vi: 'Đang tìm kiếm...' },
  'search.noResults': {
    en: 'No recipes found. Try a different search or cuisine.',
    vi: 'Không tìm thấy công thức nào. Hãy thử từ khóa hoặc ẩm thực khác.',
  },

  'recipe.loading': { en: 'Loading recipe...', vi: 'Đang tải công thức...' },
  'recipe.saving': { en: 'Saving...', vi: 'Đang lưu...' },
  'recipe.save': { en: 'Save to favorites', vi: 'Lưu vào yêu thích' },
  'recipe.ingredients': { en: 'Ingredients', vi: 'Nguyên liệu' },
  'recipe.instructions': { en: 'Instructions', vi: 'Hướng dẫn' },
  'recipe.stockPhoto': { en: 'Stock photo', vi: 'Ảnh minh họa' },
  'recipe.videoGuide': { en: 'Video guide', vi: 'Video hướng dẫn' },
  'recipe.expandButton': { en: 'Get more detailed guide', vi: 'Xem hướng dẫn chi tiết hơn' },
  'recipe.expanding': {
    en: 'Writing a more detailed guide...',
    vi: 'Đang viết hướng dẫn chi tiết hơn...',
  },

  'favorites.title': { en: 'Favorites', vi: 'Yêu thích' },
  'favorites.empty': { en: 'No favorites saved yet.', vi: 'Chưa có món ăn yêu thích nào được lưu.' },
  'favorites.remove': { en: 'Remove', vi: 'Xóa' },
  'favorites.loading': { en: 'Loading favorites...', vi: 'Đang tải danh sách yêu thích...' },

  'history.title': { en: 'History', vi: 'Lịch sử' },
  'history.empty': { en: 'No recently viewed recipes yet.', vi: 'Chưa có công thức nào được xem gần đây.' },
  'history.loading': { en: 'Loading history...', vi: 'Đang tải lịch sử...' },

  'login.title': { en: 'Sign in', vi: 'Đăng nhập' },
  'login.email': { en: 'Email', vi: 'Email' },
  'login.password': { en: 'Password', vi: 'Mật khẩu' },
  'login.submitting': { en: 'Signing in...', vi: 'Đang đăng nhập...' },
  'login.submit': { en: 'Sign in', vi: 'Đăng nhập' },
  'login.noAccount': { en: 'No account?', vi: 'Chưa có tài khoản?' },
  'login.signUpLink': { en: 'Sign up', vi: 'Đăng ký' },

  'signup.title': { en: 'Create an account', vi: 'Tạo tài khoản' },
  'signup.email': { en: 'Email', vi: 'Email' },
  'signup.password': { en: 'Password', vi: 'Mật khẩu' },
  'signup.submitting': { en: 'Creating account...', vi: 'Đang tạo tài khoản...' },
  'signup.submit': { en: 'Sign up', vi: 'Đăng ký' },
  'signup.haveAccount': { en: 'Already have an account?', vi: 'Đã có tài khoản?' },
  'signup.signInLink': { en: 'Sign in', vi: 'Đăng nhập' },
  'signup.checkEmail': {
    en: 'Check your email to confirm your account.',
    vi: 'Kiểm tra email của bạn để xác nhận tài khoản.',
  },

  'preferences.title': { en: 'Preferences', vi: 'Tùy chọn' },
  'preferences.subtitle': {
    en: 'Used to filter recipe search and personalize the AI recommendation.',
    vi: 'Dùng để lọc kết quả tìm kiếm công thức và cá nhân hóa gợi ý từ AI.',
  },
  'preferences.dietaryLabel': {
    en: 'Dietary restrictions (comma separated)',
    vi: 'Chế độ ăn kiêng (cách nhau bằng dấu phẩy)',
  },
  'preferences.dietaryPlaceholder': { en: 'vegetarian, gluten free', vi: 'chay, không gluten' },
  'preferences.dislikedLabel': {
    en: 'Disliked ingredients (comma separated)',
    vi: 'Nguyên liệu không thích (cách nhau bằng dấu phẩy)',
  },
  'preferences.dislikedPlaceholder': { en: 'cilantro, mushrooms', vi: 'rau mùi, nấm' },
  'preferences.cuisinesLabel': {
    en: 'Favorite cuisines (comma separated)',
    vi: 'Ẩm thực yêu thích (cách nhau bằng dấu phẩy)',
  },
  'preferences.cuisinesPlaceholder': { en: 'italian, thai', vi: 'ý, thái' },
  'preferences.saving': { en: 'Saving...', vi: 'Đang lưu...' },
  'preferences.save': { en: 'Save preferences', vi: 'Lưu tùy chọn' },
  'preferences.saved': { en: 'Saved.', vi: 'Đã lưu.' },
  'preferences.loading': { en: 'Loading preferences...', vi: 'Đang tải tùy chọn...' },

  'admin.title': { en: 'User management', vi: 'Quản lý người dùng' },
  'admin.loading': { en: 'Loading users...', vi: 'Đang tải danh sách người dùng...' },
  'admin.email': { en: 'Email', vi: 'Email' },
  'admin.role': { en: 'Role', vi: 'Vai trò' },
  'admin.you': { en: '(you)', vi: '(bạn)' },
  'admin.makeAdmin': { en: 'Make admin', vi: 'Cấp quyền admin' },
  'admin.makeUser': { en: 'Remove admin', vi: 'Gỡ quyền admin' },
  'admin.confirmMakeAdmin': {
    en: "Grant admin access to {email}? They'll have unlimited AI usage and be able to manage other users' roles.",
    vi: 'Cấp quyền admin cho {email}? Người này sẽ dùng AI không giới hạn và có thể quản lý vai trò của người dùng khác.',
  },
  'admin.confirmRemoveAdmin': {
    en: 'Remove admin access from {email}? They will go back to the normal daily AI limit.',
    vi: 'Gỡ quyền admin của {email}? Người này sẽ quay lại giới hạn AI hằng ngày thông thường.',
  },
} as const satisfies Record<string, Record<Language, string>>

export type TranslationKey = keyof typeof translations
