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
- Follow/unfollow user, xem followers/following ngay trong profile.
- Ket ban hai chieu: gui loi moi, chap nhan, huy/tu choi, unfriend, trang Friends.
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

### Notifications

| Method | Endpoint | Mo ta |
| --- | --- | --- |
| GET | `/notifications` | Danh sach notifications |
| GET | `/notifications/unread-count` | Dem unread |
| PATCH | `/notifications/read-all` | Mark all read |
| PATCH | `/notifications/:id/read` | Mark one read |

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

Backend hien chua co test runner that su; script `npm test` dang la placeholder.

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

- Notifications dang polling moi 30 giay, chua realtime.
- Chua co chat/messenger.
- Chua co friend request hai chieu; moi co follow/unfollow.
- Chia se hien moi copy link bai viet, chua co repost/share object dung nghia.
- Chua co save/bookmark post.
- Privacy moi o muc post `public`/`followers`/`only_me`, chua co friends/privacy matrix sau hon.
- Chua co albums/photos/videos/stories/reels.
- Chua co Groups, Pages, Events, Marketplace.
- Chua co moderation/report/admin dashboard.
- Upload van la local filesystem, chua dung S3/Cloudinary/object storage.
- Chua co test tu dong day du cho backend/frontend.
- SQL migrations hien chay tu file SQL va skip mot so loi duplicate column; chua co migration tracking table.
- Text trong mot so file/comment hien co dau hieu encoding tieng Viet bi loi, nhung UI van co nhieu chu tieng Viet dung o cac file moi.

## 10. Roadmap Full Facebook Clone

### Phase 0: Stabilize nen tang

- Chuan hoa README, env docs, setup instructions.
- Lam migration idempotent hon bang migration tracking table.
- Chuan hoa error response shape backend.
- Them validation library nhu Zod hoac express-validator.
- Them test backend cho auth, post, follow, notification.
- Them test frontend co ban cho auth flow va core pages.
- Lam lai loading/error/empty states cho dong nhat.
- Chuan hoa encoding tieng Viet trong codebase.

### Phase 1: News Feed giong Facebook hon

- Post composer ngay trong feed/profile da co ban; tiep tuc nang cap UX.
- Tao post inline da co trong feed va profile cua minh; tiep tuc toi uu optimistic UI.
- Ho tro nhieu anh trong mot post da co cho image; tiep theo them layout dep hon va media management.
- Ho tro video upload va preview.
- Edit/delete post inline tren card.
- Share ve profile da co ban bang `shared_post_id`; tiep theo lam share dialog day du hon va share count UI.
- Save/bookmark post.
- Reaction nhieu loai da co ban; tiep theo them summary/icon/count theo tung reaction.
- Feed ranking theo thoi gian, follow, interaction, goi y, do uu tien tac gia.
- Skeleton loading va optimistic UI cho like/comment/follow.

### Phase 2: Profile va social graph

- Profile tabs day du: Posts, About, Friends/Followers, Photos, Videos.
- Friend request hai chieu: send, accept, reject, cancel, unfriend.
- Song song giu follow neu muon kieu Facebook Follow.
- Privacy per post/profile: public, friends, followers, only me.
- Block/unblock user.
- Report user/post/comment.
- Gioi thieu chi tiet hon: work, education, relationship, birthday, social links.
- Activity log ca nhan.

### Phase 3: Realtime

- Dung WebSocket hoac Socket.IO.
- Notifications realtime thay cho polling.
- Realtime comments/reactions tren post dang mo.
- Messenger 1-1.
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
