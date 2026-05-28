# Auth App Social Network

README nay duoc viet de AI hoac engineer moi co the doc nhanh va hieu toan bo project: cong nghe dang dung, cau truc repo, tinh nang da co, schema/API chinh, cach chay local, gioi han hien tai va roadmap de phat trien thanh ung dung gan Facebook nhat co the.

## 1. Tong Quan

Day la mot ung dung mang xa hoi dang duoc xay tren monorepo `frontend/` va `backend/`.

App hien co cac nhom tinh nang chinh:

- Dang ky, dang nhap, dang xuat bang JWT luu trong HttpOnly cookie.
- Quan ly profile ca nhan: ten, email, bio, dia diem, website, avatar, anh bia, doi mat khau.
- Public user profile co cover/avatar, thong tin gioi thieu, bai viet, followers/following.
- Tao/sua/xoa bai viet, upload nhieu anh, privacy per post.
- Danh sach bai viet public, bai viet cua toi, chi tiet bai viet.
- Feed rieng theo nguoi dang follow, co infinite scroll.
- Comment, sua/xoa comment, reaction nhieu loai cho post.
- Save/bookmark post va trang `/saved`.
- Follow/unfollow user, xem followers/following ngay trong profile.
- Ket ban hai chieu: gui loi moi, chap nhan, huy/tu choi, unfriend, trang Friends.
- Block/unblock user, an profile/list/feed/message khi hai user da block nhau.
- Tim user, goi y follow user.
- Notification cho follow, friend request/accept, like post, comment post; co bell dropdown, unread count, trang notifications.

Ten repo/brand trong UI hien van la `Auth App`, nhung codebase da phat trien thanh social network co nhieu tinh nang gan Facebook.

## 2. Cong Nghe

### Frontend

- React `^19.2.6`
- Vite `^8.0.12`
- React Router `^7.15.0`
- CSS thuan trong `frontend/src/style.css`
- ESLint `^10.3.0`
- API client dung `fetch` voi `credentials: "include"` de gui cookie auth.

### Backend

- Node.js ESM (`"type": "module"`)
- Express `^5.2.1`
- MySQL2 `^3.22.3`
- JWT `^9.0.3`
- bcryptjs `^3.0.3`
- cookie-parser `^1.4.7`
- cors `^2.8.6`
- dotenv `^17.4.2`
- multer `^2.1.1` cho upload anh avatar, cover va post.
- nodemon cho dev server.
- Middleware tu viet cho rate limit, trusted Origin check va error response shape co `message`/`code`.

### Database / Devops

- MySQL `8.4` qua `docker-compose.yml`
- SQL migrations nam trong `backend/sql`
- Upload local filesystem nam trong `backend/uploads`
- Static uploads duoc serve qua `/uploads`

## 3. Cau Truc Repo

```text
auth-app/
  docker-compose.yml
  README.md

  backend/
    package.json
    .env.example
    sql/
      001_create_users.sql
      002_create_posts.sql
      003_create_comments.sql
      004_create_post_likes.sql
      005_add_avatar_url_to_users.sql
      006_create_follows.sql
      007_add_image_url_to_posts.sql
      008_create_notification.sql
      009_add_profile_fields_to_users.sql
      010_add_cover_url_to_users.sql
      011_add_privacy_to_posts.sql
      012_make_post_title_nullable.sql
      013_add_reaction_type_to_post_likes.sql
      014_create_post_media.sql
      015_add_shared_post_id_to_posts.sql
      016_create_friendships.sql
      017_create_conversations.sql
      018_create_conversation_members.sql
      019_create_messages.sql
      020_add_conversation_id_to_notifications.sql
      021_add_status_to_conversations.sql
      022_add_token_version_to_users.sql
      023_create_post_bookmarks.sql
      024_create_user_blocks.sql
    src/
      server.js
      config/
      db/
      middleware/
      models/
      routes/
      scripts/
      utils/
    uploads/

  frontend/
    package.json
    .env.example
    src/
      App.jsx
      main.jsx
      api/
      assets/
      components/
      context/
      pages/
      utils/
      style.css
```

### Frontend folders

- `frontend/src/App.jsx`: dinh nghia navbar va routes.
- `frontend/src/api`: wrapper goi backend API.
- `frontend/src/context`: auth context, current user, login/register/logout, update profile, upload avatar/cover.
- `frontend/src/components`: shared UI nhu `PostCard`, `SocialPostCard`, `PostComposer`, `UserCard`, `AvatarUpload`, `CoverUpload`, `NotificationBell`, `FollowListPanel`, route guards.
- `frontend/src/pages`: cac man hinh chinh: Home, Login/Register, Feed, Profile, UserProfile, PostList, PostDetail, Create/EditPost, MyPosts, Notifications, UserSearch.
- `frontend/src/style.css`: toan bo styling hien tai.

### Backend folders

- `backend/src/server.js`: setup Express, CORS, JSON body, cookie parser, static uploads, route mounting va error handler.
- `backend/src/routes`: HTTP API layer.
- `backend/src/models`: query database va transform data.
- `backend/src/middleware/requireAuth.js`: `requireAuth` va `optionalAuth`.
- `backend/src/config`: env, cookie, upload config.
- `backend/src/db/pool.js`: MySQL pool/query helper.
- `backend/src/scripts/migrate.js`: chay cac file SQL trong `backend/sql`.
- `backend/src/utils`: JWT va file upload cleanup.

## 4. Tinh Nang Da Lam Duoc

### Authentication

- Register bang name, email, password.
- Password duoc hash bang bcryptjs.
- Login tao JWT va luu vao HttpOnly cookie `auth_token`.
- Logout clear cookie.
- `/api/auth/me` lay current user tu cookie.
- Frontend co `GuestRoute` va `ProtectedRoute`.

### Profile

- User co cac field:
  - `name`
  - `email`
  - `avatarUrl`
  - `coverUrl`
  - `bio`
  - `location`
  - `website`
  - `createdAt`
  - `updatedAt`
- Trang `/profile` cho user hien tai:
  - Cap nhat name/email/bio/location/website.
  - Doi mat khau.
  - Upload avatar toi da 2MB.
  - Upload anh bia toi da 5MB.
- Trang `/users/:id` la public profile:
  - Hien cover/avatar.
  - Follow/unfollow neu khong phai minh.
  - Tabs bai viet/gioi thieu/followers/following.
  - Followers/following hien ngay trong trang, khong bat buoc dieu huong route khac.

### Posts / Blog

- Danh sach post public `/posts`.
- Chi tiet post `/posts/:id`.
- Tao post moi bang composer: content hoac anh, title khong bat buoc, privacy `public`/`followers`/`only_me`.
- Sua post va co the thay nhieu anh post.
- Xoa post, dong thoi xoa upload local lien quan.
- My Posts `/my-posts`.
- Search post theo title/content.
- Pagination cho danh sach.
- Post media moi duoc luu trong bang `post_media`; `posts.image_url` van giu de fallback cho post cu.

### Feed

- Feed rieng `/feed` yeu cau login.
- Backend tra bai viet cua user hien tai va nhung user ma current user dang follow.
- Frontend co infinite scroll bang `IntersectionObserver`.
- Co refresh feed va retry load more.
- Feed co composer inline, comment inline, reaction hover picker va share ve profile tren tung post.
- Reaction hien top 3 cam xuc nhieu nhat, hover nut Thich de chon cam xuc nhu Facebook.
- Share bai viet ve trang ca nhan bang post moi co tham chieu bai goc.
- Co Suggested Users va co the chen post cua user vua follow vao feed.

### Comments

- Lay comments theo post.
- Tao comment can login.
- Sua/xoa comment chi cho tac gia comment.
- Gioi han comment toi da 1000 ky tu.
- Tao notification khi comment vao post cua nguoi khac.

### Reactions

- Toggle reaction hoac doi reaction tren post.
- Reaction types hien co: `like`, `love`, `haha`, `wow`, `sad`, `angry`.
- Xem danh sach user da tha reaction, loc theo tung loai reaction.
- Moi post tra them `reactionSummary` de UI hien 3 loai cam xuc nhieu nhat.
- Unique constraint de moi user chi co mot reaction tren mot post.
- Tra ve `liked`, `reactionType` va `likeCount`.
- Tao notification khi user react lan dau vao post cua nguoi khac.

### Follow

- Follow/unfollow user.
- Chan self-follow/self-unfollow.
- Co bang `follows` voi unique `(follower_id, following_id)`.
- Public profile co `followerCount`, `followingCount`, `isFollowing`, `isMe`.
- Lay followers/following co pagination.
- Suggested users dua tren mutual follow, follows me, recent posts, follower count.
- Tao notification khi follow user khac.

### Friends

- Ket ban hai chieu song song voi follow.
- Gui loi moi, chap nhan, huy/tu choi loi moi va huy ket ban.
- Co bang `friendships` voi unique pair `user_low_id`/`user_high_id`.
- Public profile/search/suggestions tra them `friendCount` va `friendshipStatus`.
- Trang `/friends` co tabs loi moi den, da gui, ban be va goi y.
- Privacy post co them `friends`; chi tac gia va accepted friends xem duoc.
- Tao notification khi co friend request va khi accept friend.

### Block

- Block/unblock user tu profile hoac user card.
- Khi block, backend xoa follow va friendship giua hai user.
- User da block nhau bi an khoi search, suggestions, followers/following, friends, feed va conversations.
- Chan follow, friend request, accept friend request va message khi mot trong hai da block.
- Public profile tra `blockedByMe`, `hasBlockedMe`, `isBlocked` de UI an action/content.

### Notifications

- Bang `notifications` luu:
  - recipient
  - actor
  - type
  - post/comment lien quan
  - read/unread
  - created time
- Notification types hien co:
  - `follow`
  - `friend_request`
  - `friend_accept`
  - `post_like`
  - `post_comment`
- API unread count.
- API mark one notification as read.
- API mark all as read.
- Frontend `NotificationBell` poll moi 30 giay.
- Trang `/notifications` hien danh sach day du va mark read.

## 5. Database Hien Tai

### `users`

Luu tai khoan va profile.

Cot chinh:

- `id`
- `name`
- `email`
- `password_hash`
- `avatar_url`
- `cover_url`
- `bio`
- `location`
- `website`
- `created_at`
- `updated_at`

Rang buoc:

- `email` unique.

### `posts`

Luu bai viet.

Cot chinh:

- `id`
- `user_id`
- `shared_post_id`
- `title`
- `content`
- `image_url`
- `privacy`
- `created_at`
- `updated_at`

Rang buoc:

- `user_id` foreign key den `users(id)`, cascade delete.

### `comments`

Luu comment theo post.

Cot chinh:

- `id`
- `post_id`
- `user_id`
- `content`
- `created_at`
- `updated_at`

Rang buoc:

- `post_id` foreign key den `posts(id)`, cascade delete.
- `user_id` foreign key den `users(id)`, cascade delete.

### `post_likes`

Luu reaction cua user tren post.

Cot chinh:

- `id`
- `post_id`
- `user_id`
- `reaction_type`
- `created_at`

Rang buoc:

- Unique `(post_id, user_id)`.
- Cascade delete theo post/user.

### `post_media`

Luu nhieu media cho mot post.

Cot chinh:

- `id`
- `post_id`
- `media_url`
- `media_type`
- `sort_order`
- `created_at`

Rang buoc:

- `post_id` foreign key den `posts(id)`, cascade delete.

### `follows`

Luu quan he follower/following.

Cot chinh:

- `id`
- `follower_id`
- `following_id`
- `created_at`

Rang buoc:

- Unique `(follower_id, following_id)`.
- Check `follower_id <> following_id`.
- Cascade delete theo user.

### `friendships`

Luu quan he ket ban hai chieu.

Cot chinh:

- `id`
- `requester_id`
- `addressee_id`
- `user_low_id`
- `user_high_id`
- `status`
- `created_at`
- `responded_at`
- `updated_at`

Rang buoc:

- Unique `(user_low_id, user_high_id)`.
- `status` la `pending` hoac `accepted`.
- Cascade delete theo user.

### `user_blocks`

Luu quan he block mot chieu giua hai user.

Cot chinh:

- `id`
- `blocker_id`
- `blocked_id`
- `created_at`

Rang buoc:

- Unique `(blocker_id, blocked_id)`.
- Check `blocker_id <> blocked_id`.
- Cascade delete theo user.

### `notifications`

Luu thong bao.

Cot chinh:

- `id`
- `recipient_id`
- `actor_id`
- `type`
- `post_id`
- `comment_id`
- `is_read`
- `created_at`

Rang buoc:

- `recipient_id` cascade delete theo user.
- `actor_id` set null neu actor bi xoa.
- `post_id` cascade delete theo post.
- `comment_id` set null neu comment bi xoa.

## 6. API Chinh

Base URL local mac dinh: `http://localhost:5000/api`

Frontend doc tu `VITE_API_URL`, mac dinh fallback la `http://localhost:5000/api`.

### Auth

| Method | Endpoint | Mo ta |
| --- | --- | --- |
| POST | `/auth/register` | Dang ky va set cookie |
| POST | `/auth/login` | Dang nhap va set cookie |
| POST | `/auth/logout` | Clear cookie |
| GET | `/auth/me` | Lay current user |

### Users / Profile / Follow

| Method | Endpoint | Mo ta |
| --- | --- | --- |
| PATCH | `/users/me` | Cap nhat profile |
| PATCH | `/users/me/password` | Doi mat khau |
| PATCH | `/users/me/avatar` | Upload avatar, field form-data `avatar` |
| PATCH | `/users/me/cover` | Upload anh bia, field form-data `cover` |
| GET | `/users/search` | Tim user theo `keyword` |
| GET | `/users/suggestions` | Goi y follow |
| POST | `/users/:id/follow` | Follow user |
| DELETE | `/users/:id/follow` | Unfollow user |
| POST | `/users/:id/block` | Block user |
| DELETE | `/users/:id/block` | Unblock user |
| GET | `/users/:id/posts` | Lay post cua user |
| GET | `/users/:id/followers` | Danh sach followers |
| GET | `/users/:id/following` | Danh sach following |
| GET | `/users/:id` | Public profile |

### Friends

| Method | Endpoint | Mo ta |
| --- | --- | --- |
| POST | `/friends/requests/:userId` | Gui loi moi ket ban |
| GET | `/friends/requests` | Xem loi moi, query `type=incoming|outgoing` |
| PATCH | `/friends/requests/:userId/accept` | Chap nhan loi moi ket ban |
| DELETE | `/friends/requests/:userId` | Huy hoac tu choi loi moi |
| GET | `/friends` | Danh sach ban be, optional `userId` |
| GET | `/friends/suggestions` | Goi y ket ban |
| DELETE | `/friends/:userId` | Huy ket ban |

### Posts / Comments / Likes

| Method | Endpoint | Mo ta |
| --- | --- | --- |
| GET | `/posts` | Danh sach post public, co pagination/search |
| GET | `/posts/me` | Bai viet cua current user |
| GET | `/posts/feed` | Feed cua current user va following |
| GET | `/posts/bookmarks` | Bai viet current user da luu |
| GET | `/posts/:id` | Chi tiet post |
| POST | `/posts` | Tao post, form-data co optional `title`, `content`, `privacy`, nhieu file `media` |
| PATCH | `/posts/:id` | Sua post/privacy/media, chi tac gia |
| DELETE | `/posts/:id` | Xoa post, chi tac gia |
| GET | `/posts/:postId/comments` | Lay comments |
| POST | `/posts/:postId/comments` | Tao comment |
| PATCH | `/posts/comments/:commentId` | Sua comment |
| DELETE | `/posts/comments/:commentId` | Xoa comment |
| POST | `/posts/:postId/like` | Toggle/dổi reaction, body `{ reactionType }` |
| GET | `/posts/:postId/reactions` | Xem user da reaction, query optional `reactionType` |
| POST | `/posts/:postId/share` | Chia se bai viet ve profile current user, body optional `{ content, privacy }` |
| POST | `/posts/:postId/bookmark` | Luu hoac bo luu bai viet |

### Notifications

| Method | Endpoint | Mo ta |
| --- | --- | --- |
| GET | `/notifications` | Danh sach notifications |
| GET | `/notifications/unread-count` | Dem unread |
| GET | `/notifications/stream` | SSE stream cho notification realtime |
| PATCH | `/notifications/read-all` | Mark all read |
| PATCH | `/notifications/:id/read` | Mark one read |

### Messages

| Method | Endpoint | Mo ta |
| --- | --- | --- |
| GET | `/messages/stream` | SSE stream cho message realtime |
| GET | `/messages/conversations` | Danh sach conversations cua current user |
| GET | `/messages/requests` | Danh sach message requests |
| POST | `/messages/conversations/:userId` | Tao hoac lay conversation voi user khac |
| GET | `/messages/conversations/:conversationId/messages` | Lay messages trong conversation |
| POST | `/messages/conversations/:conversationId/messages` | Gui message |
| PATCH | `/messages/conversations/:conversationId/read` | Mark conversation as read |

## 7. Cach Chay Local

### 1. Chay MySQL bang Docker

Tu root repo:

```bash
docker compose up -d
```

MySQL container:

- Image: `mysql:8.4`
- Container: `auth_mysql`
- Port: `3306:3306`
- Database mac dinh: `auth_app`

### 2. Cau hinh backend env

Tao file `backend/.env` dua tren `backend/.env.example`:

```env
PORT=5000
NODE_ENV=development

CLIENT_URL=http://localhost:5173

DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=change_me
DB_NAME=auth_app

JWT_SECRET=change_me_to_a_long_random_secret
JWT_EXPIRES_IN=7d
```

Khong commit `.env` that vao repo.

### 3. Cai dependencies backend va migrate

```bash
cd backend
npm install
npm run migrate
npm run migrate:status
npm run dev
```

Backend chay o:

```text
http://localhost:5000
```

Health check:

```text
http://localhost:5000/api/health
```

### 4. Cau hinh frontend env

Tao file `frontend/.env` dua tren `frontend/.env.example`:

```env
VITE_API_URL=http://localhost:5000/api
```

### 5. Cai dependencies frontend va chay

```bash
cd frontend
npm install
npm run dev
```

Frontend chay o:

```text
http://localhost:5173
```

### 6. Lenh kiem tra frontend

```bash
cd frontend
npm run lint
npm run build
```

Backend da co test runner bang `node --test`, hien co test cho validation auth/profile.

## 8. Uploads

Backend dung `multer` va local filesystem:

- Avatar: `backend/uploads/avatars`, URL public `/uploads/avatars/...`, limit 2MB.
- Cover: `backend/uploads/covers`, URL public `/uploads/covers/...`, limit 5MB.
- Post image: `backend/uploads/posts`, URL public `/uploads/posts/...`, limit 5MB.

Mime types duoc cho phep:

- `image/jpeg`
- `image/png`
- `image/webp`

Khi update avatar/cover/post image, code co logic xoa file cu sau khi DB update thanh cong.

## 9. Gioi Han Hien Tai

- Notifications da co SSE realtime va van giu polling fallback o frontend.
- Chat/Messenger da co ban: conversation 1-1, message realtime bang SSE, unread count, message popup.
- Friend request hai chieu da co: send, accept, cancel/reject, unfriend.
- Share ve profile da co bang `shared_post_id`, nhung UI share dialog/share count con can nang cap.
- Save/bookmark post da co: luu/bo luu tren card va trang `/saved`.
- Da co rate limit in-memory cho auth/post/comment/reaction/message, nhung production can chuyen sang Redis/shared store.
- Da co trusted Origin check cho unsafe request co auth cookie, nhung chua co CSRF token rieng.
- Error response da co `message` va `code` o mot so middleware/route moi; cac route cu can duoc chuan hoa dan.
- Save/bookmark post da co ban, nhung chua co collection/folder rieng.
- Privacy post da co `public`/`followers`/`friends`/`only_me`, nhung chua co privacy matrix sau hon cho profile, comment, media.
- Chua co albums/photos/videos/stories/reels.
- Chua co Groups, Pages, Events, Marketplace.
- Chua co moderation/report/admin dashboard.
- Upload van la local filesystem, chua dung S3/Cloudinary/object storage.
- Chua co test tu dong day du cho backend/frontend; backend moi co test validation auth/profile.
- SQL migrations da co `schema_migrations` de track file da ap dung, nhung chua co rollback/down migration.
- Text tieng Viet trong source dang la UTF-8; neu terminal hien `ThÃ´ng bÃ¡o` thi can doi terminal/editor sang UTF-8.

## 10. Roadmap Full Facebook Clone

### Phase 0: Stabilize nen tang

- Chuan hoa README, env docs, setup instructions.
- Hoan thien migration workflow: da co tracking table, tiep theo them rollback strategy va migration status command.
- Chuan hoa error response shape backend.
- Them validation library nhu Zod hoac express-validator.
- Nang rate limit tu in-memory len Redis/shared store khi deploy nhieu instance.
- Bo sung CSRF token rieng neu backend can ho tro nhieu client origin hoac form submit ngoai SPA.
- Them test backend cho auth, post privacy, friend, message, notification.
- Them test frontend co ban cho auth flow, feed, notification va messages.
- Lam lai loading/error/empty states cho dong nhat.
- Dam bao tat ca editor/terminal/deploy pipeline dung UTF-8.

### Phase 1: News Feed giong Facebook hon

- Post composer ngay trong feed/profile da co ban; tiep tuc nang cap UX.
- Tao post inline da co trong feed va profile cua minh; tiep tuc toi uu optimistic UI.
- Ho tro nhieu anh trong mot post da co cho image; tiep theo them layout dep hon va media management.
- Ho tro video upload va preview.
- Edit/delete post inline tren card.
- Share ve profile da co ban bang `shared_post_id`; tiep theo lam share dialog day du hon va share count UI.
- Save/bookmark post da co ban; tiep theo them collection/folder va search trong saved posts.
- Reaction nhieu loai da co ban; tiep theo them summary/icon/count theo tung reaction.
- Feed ranking theo thoi gian, follow, interaction, goi y, do uu tien tac gia.
- Skeleton loading va optimistic UI cho like/comment/follow.

### Phase 2: Profile va social graph

- Profile tabs day du: Posts, About, Friends/Followers, Photos, Videos.
- Friend request hai chieu: send, accept, reject, cancel, unfriend.
- Song song giu follow neu muon kieu Facebook Follow.
- Privacy per post/profile: public, friends, followers, only me.
- Report user/post/comment.
- Gioi thieu chi tiet hon: work, education, relationship, birthday, social links.
- Activity log ca nhan.

### Phase 3: Realtime

- Notifications va Messenger 1-1 da co SSE realtime; tiep theo can reconnect/backoff tot hon va typing/presence.
- Realtime comments/reactions tren post dang mo.
- Group chat.
- Typing indicator.
- Read receipts.
- Online/offline presence.
- Push notification ve sau neu co mobile/PWA.

### Phase 4: Media, Stories, Reels

- Chuyen upload local sang object storage nhu S3, Cloudinary hoac MinIO.
- Photo albums.
- Media viewer full screen.
- Video upload, thumbnail, basic transcoding pipeline.
- Stories het han sau 24h.
- Story viewer va story replies.
- Short video/reels feed co infinite scroll.
- Luu metadata media rieng thay vi chi `image_url` tren posts/users.

### Phase 5: Groups, Pages, Events

- Groups:
  - Tao group.
  - Join/leave/request join.
  - Role admin/mod/member.
  - Group feed.
  - Group moderation.
- Pages:
  - Tao page.
  - Follow page.
  - Page profile va page posts.
  - Page role/admin.
- Events:
  - Tao event.
  - RSVP going/interested/not going.
  - Event feed.
  - Event invite.

### Phase 6: Moderation, Admin, Production

- Admin dashboard.
- Report queue cho user/post/comment/message.
- Content moderation workflow.
- Rate limiting.
- CSRF strategy ro rang cho cookie auth.
- Security headers.
- Audit log.
- Structured logging.
- Monitoring va error tracking.
- Backup/restore MySQL.
- CI pipeline lint/build/test.
- Production deployment docs.
- CDN/object storage cho media.
- Database indexes va query optimization cho scale lon.

## 11. Ghi Chu Cho AI/Engineer Tiep Theo

- Project dang o trang thai prototype social network, khong con chi la auth app.
- Neu can lam feature moi, nen doc truoc:
  - `frontend/src/App.jsx`
  - `frontend/src/api/*.js`
  - `backend/src/routes/*.js`
  - `backend/src/models/*.js`
  - `backend/sql/*.sql`
- Khi them API moi:
  - Them route trong backend.
  - Them model/query rieng neu lien quan DB.
  - Them API wrapper trong frontend `src/api`.
  - Cap nhat UI page/component.
  - Cap nhat README neu la feature lon.
- Khi them bang/cot DB:
  - Tao file SQL moi trong `backend/sql` voi prefix tang dan.
  - Chay `npm run migrate` trong `backend`.
- Khi them upload moi:
  - Them upload dir trong `backend/src/config/upload.js`.
  - Dung `deleteLocalUpload` de cleanup khi co loi hoac thay file cu.
  - Serve file qua `/uploads`.
