# TODO

- [ ] Fix `app/voicechat.tsx` to support video:
  - [x] Request camera + mic (`video: true`).
  - [x] Render local + remote video using `RTCView`.
- [ ] Fix ICE candidate routing in `app/voicechat.tsx`:
  - [x] Store matched `peerId` in a ref during `match_found`.
  - [x] Emit `ice_candidate` to that stored `peerId`.
- [ ] Re-test matchmaking video chat on two devices.
- [ ] If still not working, inspect `backend/sockets/videoChat.js` and verify event names + parameters.
