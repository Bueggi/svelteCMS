import { pgTable, uuid, text, integer, boolean, timestamp, primaryKey, pgEnum, unique, json, serial } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const userRoleEnum = pgEnum('user_role', ['admin', 'instructor', 'moderator', 'student']);
export const automationTriggerEnum = pgEnum('automation_trigger', ['user.created', 'enrollment.created', 'purchase.completed', 'lesson.completed', 'course.completed']);
export const automationLogStatusEnum = pgEnum('automation_log_status', ['success', 'error']);
export const inboundWebhookActionEnum = pgEnum('inbound_webhook_action', [
    'enroll_user',
    'unenroll_user',
    'create_user',
    'complete_lesson',
    'complete_course',
    'reset_progress',
    'update_user_role',
    'send_email',
    'activate_enrollment',
    'grant_coupon',
    'set_enrollment_expiry',
]);
export const lessonTypeEnum = pgEnum('lesson_type', ['video', 'text', 'quiz']);
export const languageEnum = pgEnum('language', ['de', 'en', 'es', 'fr']);
export const purchaseStatusEnum = pgEnum('purchase_status', ['completed', 'refunded', 'disputed']);
export const courseAccessTypeEnum = pgEnum('course_access_type', ['lifetime', 'duration', 'subscription']);
export const enrollmentStatusEnum = pgEnum('enrollment_status', ['active', 'expired', 'cancelled']);
export const subscriptionIntervalEnum = pgEnum('subscription_interval', ['month', 'year']);
export const couponDiscountTypeEnum = pgEnum('coupon_discount_type', ['percentage', 'amount']);
export const couponApplicableToEnum = pgEnum('coupon_applicable_to', ['all', 'specific']);
export const invoiceStatusEnum = pgEnum('invoice_status', ['issued', 'paid', 'void', 'refunded']);
export const invoiceTypeEnum = pgEnum('invoice_type', ['one_time', 'subscription', 'installment']);

/**
 * Site Configuration & Theming
 */

export const siteSettings = pgTable('site_settings', {
	id: integer('id').primaryKey().default(1), // Single row settings
	appName: text('app_name').notNull().default('Svelte Course'),
	logoUrl: text('logo_url'),
	logoText: text('logo_text'),
	faviconUrl: text('favicon_url'),
	adminName: text('admin_name'),
	adminEmail: text('admin_email'),
	activeTheme: text('active_theme').notNull().default('luxurious'),
	defaultLanguage: languageEnum('default_language').notNull().default('de'),
	primaryColor: text('primary_color').notNull().default('15 60% 65%'),
	secondaryColor: text('secondary_color').notNull().default('38 70% 55%'),
	accentColor: text('accent_color').notNull().default('15 60% 65%'),
	backgroundColor: text('background_color').notNull().default('40 33% 97%'),
	foregroundColor: text('foreground_color').notNull().default('30 10% 15%'),
	updatedAt: timestamp('updated_at').notNull().defaultNow(),

	// Setup wizard
	setupCompleted: boolean('setup_completed').notNull().default(false),

	// Stripe (DB fallback when env vars not set)
	stripeSecretKey: text('stripe_secret_key'),
	stripePublishableKey: text('stripe_publishable_key'),
	stripeWebhookSecret: text('stripe_webhook_secret'),
	stripeTestSecretKey: text('stripe_test_secret_key'),
	stripeTestPublishableKey: text('stripe_test_publishable_key'),

	// SMTP (DB fallback when env vars not set)
	smtpHost: text('smtp_host'),
	smtpPort: text('smtp_port'),
	smtpUser: text('smtp_user'),
	smtpPass: text('smtp_pass'),
	smtpSecure: boolean('smtp_secure').default(false),
	smtpFrom: text('smtp_from'),

	// PayPal (DB fallback when env vars not set)
	paypalClientId: text('paypal_client_id'),
	paypalClientSecret: text('paypal_client_secret'),
	paypalSandbox: boolean('paypal_sandbox').notNull().default(true),
	enabledPaymentMethods: text('enabled_payment_methods').notNull().default('["card"]'),

	// Tax & Invoice
	vatRate: integer('vat_rate').notNull().default(0),           // e.g. 19 for 19 %
	reverseChargeEnabled: boolean('reverse_charge_enabled').notNull().default(false),

	// Company information (for legally compliant invoices)
	companyName: text('company_name'),
	companyStreet: text('company_street'),
	companyCity: text('company_city'),
	companyZip: text('company_zip'),
	companyCountry: text('company_country').default('DE'),
	companyVatId: text('company_vat_id'),    // e.g. DE123456789
	companyEmail: text('company_email'),
	companyPhone: text('company_phone'),

	// Invoice configuration
	invoicePrefix: text('invoice_prefix').notNull().default('INV'),
	invoiceNextNumber: integer('invoice_next_number').notNull().default(1),
	invoiceTemplate: text('invoice_template'),   // Custom HTML template (null = use default)
	invoiceFooter: text('invoice_footer'),        // Legal footer text

	// Access control
	registrationEnabled: boolean('registration_enabled').notNull().default(true),

	// Site URL (used for Stripe success/cancel redirect URLs)
	siteUrl: text('site_url'),

	// Checkout customization
	checkoutButtonColor: text('checkout_button_color'),  // hex, e.g. #e86a3a
	checkoutLegalTexts: text('checkout_legal_texts'),    // JSON: string[] — one required checkbox per item
});

/**
 * Tax Rates (per-country VAT configuration)
 */

export const taxRates = pgTable('tax_rates', {
	id: uuid('id').primaryKey().defaultRandom(),
	countryCode: text('country_code').notNull().unique(), // ISO 3166-1 alpha-2, e.g. 'DE'
	countryName: text('country_name').notNull(),
	rate: integer('rate').notNull().default(0),           // e.g. 19 for 19%
	isEnabled: boolean('is_enabled').notNull().default(true),
	createdAt: timestamp('created_at').notNull().defaultNow(),
});

/**
 * Better Auth Tables
 */

export const user = pgTable('user', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	email: text('email').notNull().unique(),
	emailVerified: boolean('email_verified').notNull(),
	image: text('image'),
	createdAt: timestamp('created_at').notNull(),
	updatedAt: timestamp('updated_at').notNull(),
	
	// Custom Fields
	role: userRoleEnum('role').notNull().default('student'),
	language: languageEnum('language').notNull().default('de'),
	stripeCustomerId: text('stripe_customer_id').unique(),
});

export const session = pgTable('session', {
	id: text('id').primaryKey(),
	expiresAt: timestamp('expires_at').notNull(),
	token: text('token').notNull().unique(),
	createdAt: timestamp('created_at').notNull(),
	updatedAt: timestamp('updated_at').notNull(),
	ipAddress: text('ip_address'),
	userAgent: text('user_agent'),
	userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
});

export const account = pgTable('account', {
	id: text('id').primaryKey(),
	accountId: text('account_id').notNull(),
	providerId: text('provider_id').notNull(),
	userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
	accessToken: text('access_token'),
	refreshToken: text('refresh_token'),
	idToken: text('id_token'),
	accessTokenExpiresAt: timestamp('access_token_expires_at'),
	refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
	scope: text('scope'),
	password: text('password'),
	createdAt: timestamp('created_at').notNull(),
	updatedAt: timestamp('updated_at').notNull(),
});

export const verification = pgTable('verification', {
	id: text('id').primaryKey(),
	identifier: text('identifier').notNull(),
	value: text('value').notNull(),
	expiresAt: timestamp('expires_at').notNull(),
	createdAt: timestamp('created_at'),
	updatedAt: timestamp('updated_at'),
});

/**
 * 1. Core LMS
 */

export const courses = pgTable('courses', {
	id: uuid('id').primaryKey().defaultRandom(),
	title: text('title').notNull(),
	subtitle: text('subtitle'),
	description: text('description'),
	slug: text('slug').notNull().unique(),
	fullDescription: text('full_description'),
	thumbnailUrl: text('thumbnail_url'),
	price: integer('price').notNull().default(0), // in cents
	isPublished: boolean('is_published').notNull().default(false),
	instructorId: text('instructor_id').notNull().references(() => user.id),
	accessType: courseAccessTypeEnum('access_type').notNull().default('lifetime'),
	accessDuration: integer('access_duration'), // in days,
	subscriptionInterval: subscriptionIntervalEnum('subscription_interval'),
	createdAt: timestamp('created_at').notNull().defaultNow(),
	updatedAt: timestamp('updated_at').notNull().defaultNow(),
	landingPageData: text('landing_page_data'),
	landingPageStatus: text('landing_page_status').notNull().default('draft'),
	checkoutBlocks: text('checkout_blocks'),
	checkoutMode: text('checkout_mode').notNull().default('separate'),
	communityEnabled: boolean('community_enabled').notNull().default(true),
	trialDays: integer('trial_days'),
});

export const course_moderators = pgTable('course_moderators', {
	courseId: uuid('course_id').notNull().references(() => courses.id, { onDelete: 'cascade' }),
	moderatorId: text('moderator_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
	assignedAt: timestamp('assigned_at').notNull().defaultNow(),
}, (t) => ({
	pk: primaryKey({ columns: [t.courseId, t.moderatorId] }),
}));

export const modules = pgTable('modules', {
	id: uuid('id').primaryKey().defaultRandom(),
	courseId: uuid('course_id').notNull().references(() => courses.id, { onDelete: 'cascade' }),
	title: text('title').notNull(),
	description: text('description'),
	order: integer('order').notNull().default(0),
	createdAt: timestamp('created_at').notNull().defaultNow(),
	updatedAt: timestamp('updated_at').notNull().defaultNow()
});

export const lessons = pgTable('lessons', {
	id: uuid('id').primaryKey().defaultRandom(),
	moduleId: uuid('module_id').notNull().references(() => modules.id, { onDelete: 'cascade' }),
	title: text('title').notNull(),
	content: text('content'), // HTML or JSON
	type: lessonTypeEnum('type').notNull().default('video'),
	videoUrl: text('video_url'),
	duration: integer('duration'), // minutes
	isFreePreview: boolean('is_free_preview').notNull().default(false),
	isPublished: boolean('is_published').notNull().default(false),
	dripDays: integer('drip_days'), // null = immediately available; N = unlock N days after enrollment
	order: integer('order').notNull().default(0),
	createdAt: timestamp('created_at').notNull().defaultNow(),
	updatedAt: timestamp('updated_at').notNull().defaultNow()
});

export const userProgress = pgTable('user_progress', {
	userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
	lessonId: uuid('lesson_id').notNull().references(() => lessons.id, { onDelete: 'cascade' }),
	isCompleted: boolean('is_completed').notNull().default(true),
	completedAt: timestamp('completed_at').notNull().defaultNow(),
}, (t) => ({
	pk: primaryKey({ columns: [t.userId, t.lessonId] }),
}));

export const enrollments = pgTable('enrollments', {
	userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
	courseId: uuid('course_id').notNull().references(() => courses.id, { onDelete: 'cascade' }),
	enrolledAt: timestamp('enrolled_at').notNull().defaultNow(),
	expiresAt: timestamp('expires_at'),
	status: enrollmentStatusEnum('status').notNull().default('active'),
	stripeSubscriptionId: text('stripe_subscription_id'),
	currentPeriodEnd: timestamp('current_period_end'),
	cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),
}, (t) => ({
	pk: primaryKey({ columns: [t.userId, t.courseId] }),
}));

/**
 * 2. Community Feature
 */

export const communityCategories = pgTable('community_categories', {
	id: uuid('id').primaryKey().defaultRandom(),
	name: text('name').notNull(),
	description: text('description'),
	order: integer('order').notNull().default(0),
    courseId: uuid('course_id').notNull().references(() => courses.id, { onDelete: 'cascade' }),
});

export const communityPosts = pgTable('community_posts', {
	id: uuid('id').primaryKey().defaultRandom(),
	categoryId: uuid('category_id').notNull().references(() => communityCategories.id, { onDelete: 'cascade' }),
	authorId: text('author_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
	title: text('title').notNull(),
	body: text('body').notNull(),
	createdAt: timestamp('created_at').notNull().defaultNow(),
	updatedAt: timestamp('updated_at').notNull().defaultNow()
});

export const communityComments = pgTable('community_comments', {
	id: uuid('id').primaryKey().defaultRandom(),
	postId: uuid('post_id').notNull().references(() => communityPosts.id, { onDelete: 'cascade' }),
	authorId: text('author_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
	body: text('body').notNull(),
	parentId: uuid('parent_id'),
	createdAt: timestamp('created_at').notNull().defaultNow(),
	updatedAt: timestamp('updated_at').notNull().defaultNow()
});

/**
 * 3. Calendar & Events
 */

export const calendarEvents = pgTable('calendar_events', {
	id: uuid('id').primaryKey().defaultRandom(),
	title: text('title').notNull(),
	description: text('description'),
	startTime: timestamp('start_time').notNull(),
	endTime: timestamp('end_time').notNull(),
	courseId: uuid('course_id').references(() => courses.id, { onDelete: 'set null' }),
	instructorId: text('instructor_id').notNull().references(() => user.id),
	createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const eventRegistrations = pgTable('event_registrations', {
	userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
	eventId: uuid('event_id').notNull().references(() => calendarEvents.id, { onDelete: 'cascade' }),
	registeredAt: timestamp('registered_at').notNull().defaultNow(),
}, (t) => ({
	pk: primaryKey({ columns: [t.userId, t.eventId] }),
}));

/**
 * 4. Commerce
 */

export const purchases = pgTable('purchases', {
	id: uuid('id').primaryKey().defaultRandom(),
	userId: text('user_id').notNull().references(() => user.id),
	courseId: uuid('course_id').notNull().references(() => courses.id),
	stripeCheckoutSessionId: text('stripe_checkout_session_id').notNull().unique(),
	amount: integer('amount').notNull(), // in cents
	status: purchaseStatusEnum('status').notNull().default('completed'),
	paymentProvider: text('payment_provider').notNull().default('stripe'),
	createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const invoices = pgTable('invoices', {
	id: uuid('id').primaryKey().defaultRandom(),
	invoiceNumber: text('invoice_number').notNull().unique(), // e.g. INV-2026-0001

	purchaseId: uuid('purchase_id').references(() => purchases.id, { onDelete: 'set null' }),
	userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),

	// Customer snapshot (preserved even if user data changes later)
	customerName: text('customer_name').notNull().default(''),
	customerEmail: text('customer_email').notNull().default(''),
	customerAddressJson: text('customer_address_json'), // JSON: { line1, line2, city, postal_code, country }
	customerVatId: text('customer_vat_id'),

	// Financial data (all amounts in cents)
	items: text('items').notNull().default('[]'), // JSON: InvoiceItem[]
	subtotalCents: integer('subtotal_cents').notNull().default(0),
	vatRate: integer('vat_rate').notNull().default(0),   // e.g. 19 for 19 %
	vatCents: integer('vat_cents').notNull().default(0),
	totalCents: integer('total_cents').notNull().default(0),
	currency: text('currency').notNull().default('eur'),
	isReverseCharge: boolean('is_reverse_charge').notNull().default(false),

	// Stripe reference
	stripeInvoiceId: text('stripe_invoice_id'),
	stripePdfUrl: text('stripe_pdf_url'),       // Stripe-hosted PDF URL (when available)

	// Rendered HTML snapshot from the template at creation time
	htmlSnapshot: text('html_snapshot'),

	status: invoiceStatusEnum('status').notNull().default('issued'),
	type: invoiceTypeEnum('type').notNull().default('one_time'),

	invoiceDate: timestamp('invoice_date').notNull().defaultNow(),
	createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const reviews = pgTable('reviews', {
	id: uuid('id').primaryKey().defaultRandom(),
	userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
	courseId: uuid('course_id').notNull().references(() => courses.id, { onDelete: 'cascade' }),
	rating: integer('rating').notNull(), // 1-5
	body: text('body'),
	createdAt: timestamp('created_at').notNull().defaultNow(),
	updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
	unq: unique().on(t.userId, t.courseId), // one review per user per course
}));

export const moduleRatings = pgTable('module_ratings', {
	id: uuid('id').primaryKey().defaultRandom(),
	userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
	moduleId: uuid('module_id').notNull().references(() => modules.id, { onDelete: 'cascade' }),
	rating: integer('rating').notNull(), // 1-5
	createdAt: timestamp('created_at').notNull().defaultNow(),
	updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
	unq: unique().on(t.userId, t.moduleId),
}));

export const upsells = pgTable('upsells', {
	id: uuid('id').primaryKey().defaultRandom(),
	sourceCourseId: uuid('source_course_id').notNull().references(() => courses.id, { onDelete: 'cascade' }),
	upsellCourseId: uuid('upsell_course_id').notNull().references(() => courses.id, { onDelete: 'cascade' }),
	label: text('label'), // Custom label shown in order bump, e.g. "Add Advanced SvelteKit"
	discountPercent: integer('discount_percent').notNull().default(0), // 0-100
	isActive: boolean('is_active').notNull().default(true),
	order: integer('order').notNull().default(0),
	createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const coupons = pgTable('coupons', {
	id: uuid('id').primaryKey().defaultRandom(),
	code: text('code').notNull().unique(),
	discountType: couponDiscountTypeEnum('discount_type').notNull().default('percentage'),
	discountValue: integer('discount_value').notNull(), // percentage (0-100) or amount in cents
	applicableTo: couponApplicableToEnum('applicable_to').notNull().default('all'),
	courseId: uuid('course_id').references(() => courses.id, { onDelete: 'cascade' }),
	expiresAt: timestamp('expires_at'),
	isActive: boolean('is_active').notNull().default(true),
	createdAt: timestamp('created_at').notNull().defaultNow(),
	updatedAt: timestamp('updated_at').notNull().defaultNow()
});

/**
 * 7. Funnels
 */

export const funnels = pgTable('funnels', {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    slug: text('slug').notNull().unique(),
    courseId: uuid('course_id').notNull().references(() => courses.id, { onDelete: 'cascade' }),
    isActive: boolean('is_active').notNull().default(true),
    salesPageBlocks: text('sales_page_blocks'),
    salesPageStatus: text('sales_page_status').notNull().default('draft'),
    checkoutMode: text('checkout_mode').notNull().default('separate'),
    thankYouBlocks: text('thank_you_blocks'),
    thankYouPageStatus: text('thank_you_page_status').notNull().default('draft'),
    trackingPixels: text('tracking_pixels'),
    sandboxMode: boolean('sandbox_mode').notNull().default(false),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const funnelBumps = pgTable('funnel_bumps', {
    id: uuid('id').primaryKey().defaultRandom(),
    funnelId: uuid('funnel_id').notNull().references(() => funnels.id, { onDelete: 'cascade' }),
    courseId: uuid('course_id').notNull().references(() => courses.id, { onDelete: 'cascade' }),
    label: text('label'),
    specialPrice: integer('special_price'),
    order: integer('order').notNull().default(0),
    createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const funnelUpsells = pgTable('funnel_upsells', {
    id: uuid('id').primaryKey().defaultRandom(),
    funnelId: uuid('funnel_id').notNull().references(() => funnels.id, { onDelete: 'cascade' }),
    courseId: uuid('course_id').notNull().references(() => courses.id, { onDelete: 'cascade' }),
    order: integer('order').notNull().default(0),
    blocks: text('blocks'),
    status: text('status').notNull().default('draft'),
    specialPrice: integer('special_price'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const funnelCheckoutPages = pgTable('funnel_checkout_pages', {
    id: uuid('id').primaryKey().defaultRandom(),
    funnelId: uuid('funnel_id').notNull().references(() => funnels.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    blocks: text('blocks'),
    status: text('status').notNull().default('draft'),
    order: integer('order').notNull().default(0),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Relations
export const userRelations = relations(user, ({ many }) => ({
	courses: many(courses, { relationName: 'instructor' }),
	enrollments: many(enrollments, { relationName: 'enrollments' }),
	progress: many(userProgress),
	posts: many(communityPosts),
	comments: many(communityComments),
    sessions: many(session),
    accounts: many(account),
    moderatedCourses: many(course_moderators, { relationName: 'moderator_user' }),
}));

export const coursesRelations = relations(courses, ({ one, many }) => ({
	instructor: one(user, { fields: [courses.instructorId], references: [user.id], relationName: 'instructor' }),
	modules: many(modules),
	enrollments: many(enrollments, { relationName: 'course_enrollments' }),
	events: many(calendarEvents, { relationName: 'course_events' }),
    moderators: many(course_moderators, { relationName: 'course_moderators' }),
    communityCategories: many(communityCategories, { relationName: 'course_categories' }),
    coupons: many(coupons),
    upsells: many(upsells, { relationName: 'source_upsells' }),
    reviews: many(reviews),
    funnels: many(funnels, { relationName: 'funnel_course' }),
}));

export const communityCategoriesRelations = relations(communityCategories, ({ one, many }) => ({
    course: one(courses, { fields: [communityCategories.courseId], references: [courses.id], relationName: 'course_categories' }),
    posts: many(communityPosts),
}));

export const courseModeratorsRelations = relations(course_moderators, ({ one }) => ({
    course: one(courses, { fields: [course_moderators.courseId], references: [courses.id], relationName: 'course_moderators' }),
    moderator: one(user, { fields: [course_moderators.moderatorId], references: [user.id], relationName: 'moderator_user' }),
}));

export const modulesRelations = relations(modules, ({ one, many }) => ({
	course: one(courses, { fields: [modules.courseId], references: [courses.id] }),
	lessons: many(lessons),
	moduleRatings: many(moduleRatings),
}));

export const lessonsRelations = relations(lessons, ({ one, many }) => ({
	module: one(modules, { fields: [lessons.moduleId], references: [modules.id] }),
	progress: many(userProgress),
}));

export const communityPostsRelations = relations(communityPosts, ({ one, many }) => ({
	author: one(user, { fields: [communityPosts.authorId], references: [user.id] }),
	category: one(communityCategories, { fields: [communityPosts.categoryId], references: [communityCategories.id] }),
	comments: many(communityComments),
}));

export const communityCommentsRelations = relations(communityComments, ({ one, many }) => ({
	author: one(user, { fields: [communityComments.authorId], references: [user.id] }),
	post: one(communityPosts, { fields: [communityComments.postId], references: [communityPosts.id] }),
	parent: one(communityComments, { fields: [communityComments.parentId], references: [communityComments.id], relationName: 'replies' }),
	replies: many(communityComments, { relationName: 'replies' }),
}));

export const calendarEventsRelations = relations(calendarEvents, ({ one }) => ({
    course: one(courses, { fields: [calendarEvents.courseId], references: [courses.id], relationName: 'course_events' }),
    instructor: one(user, { fields: [calendarEvents.instructorId], references: [user.id] }),
}));

export const enrollmentsRelations = relations(enrollments, ({ one }) => ({
    user: one(user, { fields: [enrollments.userId], references: [user.id], relationName: 'enrollments' }),
    course: one(courses, { fields: [enrollments.courseId], references: [courses.id], relationName: 'course_enrollments' }),
}));

export const sessionRelations = relations(session, ({ one }) => ({
	user: one(user, { fields: [session.userId], references: [user.id] }),
}));

export const accountRelations = relations(account, ({ one }) => ({
	user: one(user, { fields: [account.userId], references: [user.id] }),
}));

export const userProgressRelations = relations(userProgress, ({ one }) => ({
    user: one(user, { fields: [userProgress.userId], references: [user.id] }),
    lesson: one(lessons, { fields: [userProgress.lessonId], references: [lessons.id] }),
}));

export const purchasesRelations = relations(purchases, ({ one, many }) => ({
    user: one(user, { fields: [purchases.userId], references: [user.id] }),
    course: one(courses, { fields: [purchases.courseId], references: [courses.id] }),
    invoices: many(invoices),
}));

export const invoicesRelations = relations(invoices, ({ one }) => ({
    user: one(user, { fields: [invoices.userId], references: [user.id] }),
    purchase: one(purchases, { fields: [invoices.purchaseId], references: [purchases.id] }),
}));

export const couponsRelations = relations(coupons, ({ one }) => ({
    course: one(courses, { fields: [coupons.courseId], references: [courses.id] }),
}));

export const reviewsRelations = relations(reviews, ({ one }) => ({
    user: one(user, { fields: [reviews.userId], references: [user.id] }),
    course: one(courses, { fields: [reviews.courseId], references: [courses.id] }),
}));

export const moduleRatingsRelations = relations(moduleRatings, ({ one }) => ({
    user: one(user, { fields: [moduleRatings.userId], references: [user.id] }),
    module: one(modules, { fields: [moduleRatings.moduleId], references: [modules.id] }),
}));

/**
 * 6. Automations & Webhooks
 */

export const automations = pgTable('automations', {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    description: text('description'),
    triggerEvent: automationTriggerEnum('trigger_event').notNull(),
    url: text('url').notNull(),
    method: text('method').notNull().default('POST'),
    headers: json('headers').$type<{ key: string; value: string }[]>().notNull().default([]),
    bodyTemplate: text('body_template').notNull().default('{}'),
    isEnabled: boolean('is_enabled').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const automationLogs = pgTable('automation_logs', {
    id: uuid('id').primaryKey().defaultRandom(),
    automationId: uuid('automation_id').notNull().references(() => automations.id, { onDelete: 'cascade' }),
    triggeredAt: timestamp('triggered_at').notNull().defaultNow(),
    status: automationLogStatusEnum('status').notNull(),
    statusCode: integer('status_code'),
    responseBody: text('response_body'),
    errorMessage: text('error_message'),
    payload: text('payload'),
});

export const inboundWebhooks = pgTable('inbound_webhooks', {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    secretToken: text('secret_token').notNull().unique(),
    action: inboundWebhookActionEnum('action').notNull(),
    config: json('config').$type<Record<string, any>>().notNull().default({}),
    isEnabled: boolean('is_enabled').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const inboundWebhookLogs = pgTable('inbound_webhook_logs', {
    id: uuid('id').primaryKey().defaultRandom(),
    webhookId: uuid('webhook_id').notNull().references(() => inboundWebhooks.id, { onDelete: 'cascade' }),
    receivedAt: timestamp('received_at').notNull().defaultNow(),
    status: automationLogStatusEnum('status').notNull(),
    payload: text('payload'),
    errorMessage: text('error_message'),
});

export const automationsRelations = relations(automations, ({ many }) => ({
    logs: many(automationLogs),
}));
export const automationLogsRelations = relations(automationLogs, ({ one }) => ({
    automation: one(automations, { fields: [automationLogs.automationId], references: [automations.id] }),
}));
export const inboundWebhooksRelations = relations(inboundWebhooks, ({ many }) => ({
    logs: many(inboundWebhookLogs),
}));
export const inboundWebhookLogsRelations = relations(inboundWebhookLogs, ({ one }) => ({
    webhook: one(inboundWebhooks, { fields: [inboundWebhookLogs.webhookId], references: [inboundWebhooks.id] }),
}));

export const upsellsRelations = relations(upsells, ({ one }) => ({
    sourceCourse: one(courses, { fields: [upsells.sourceCourseId], references: [courses.id], relationName: 'source_upsells' }),
    upsellCourse: one(courses, { fields: [upsells.upsellCourseId], references: [courses.id], relationName: 'upsell_target' }),
}));

export const eventRegistrationsRelations = relations(eventRegistrations, ({ one }) => ({
    user: one(user, { fields: [eventRegistrations.userId], references: [user.id] }),
    event: one(calendarEvents, { fields: [eventRegistrations.eventId], references: [calendarEvents.id] }),
}));

export const funnelsRelations = relations(funnels, ({ one, many }) => ({
    course: one(courses, { fields: [funnels.courseId], references: [courses.id], relationName: 'funnel_course' }),
    bumps: many(funnelBumps),
    upsells: many(funnelUpsells),
    checkoutPages: many(funnelCheckoutPages),
}));

export const funnelBumpsRelations = relations(funnelBumps, ({ one }) => ({
    funnel: one(funnels, { fields: [funnelBumps.funnelId], references: [funnels.id] }),
    course: one(courses, { fields: [funnelBumps.courseId], references: [courses.id], relationName: 'bump_course' }),
}));

export const funnelUpsellsRelations = relations(funnelUpsells, ({ one }) => ({
    funnel: one(funnels, { fields: [funnelUpsells.funnelId], references: [funnels.id] }),
    course: one(courses, { fields: [funnelUpsells.courseId], references: [courses.id], relationName: 'upsell_course' }),
}));

export const funnelCheckoutPagesRelations = relations(funnelCheckoutPages, ({ one }) => ({
    funnel: one(funnels, { fields: [funnelCheckoutPages.funnelId], references: [funnels.id] }),
}));

/**
 * Media Library
 */
export const mediaFiles = pgTable('media_files', {
    id:           serial('id').primaryKey(),
    filename:     text('filename').notNull(),
    url:          text('url').notNull(),       // full size (max 1920px)
    url800:       text('url_800'),             // medium variant (max 800px)
    url400:       text('url_400'),             // small variant (max 400px)
    blurDataUrl:  text('blur_data_url'),       // base64 LQIP placeholder
    originalName: text('original_name'),
    mimeType:     text('mime_type'),
    size:         integer('size'),             // bytes of full-size file
    width:        integer('width'),
    height:       integer('height'),
    uploadedBy:   text('uploaded_by').references(() => user.id, { onDelete: 'set null' }),
    createdAt:    timestamp('created_at').defaultNow().notNull(),
});

export const mediaFilesRelations = relations(mediaFiles, ({ one }) => ({
    uploader: one(user, { fields: [mediaFiles.uploadedBy], references: [user.id] }),
}));
