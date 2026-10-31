import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Mic, MicOff, PhoneOff, Video, VideoOff } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { buildWsUrl } from '@/services/websocket';
import { missedMessage, missedNextStep } from '@/lib/missed';
import { fetchMeeting, type MeetingDetails } from '@/services/video';
import { useAuthStore } from '@/store/authStore';

type Signal = { type: string; data?: unknown };

function when(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' });
}

/** Why the browser would not give us the camera or microphone, in words a person can act on. */
function mediaProblem(err: unknown): string {
  if (!navigator.mediaDevices?.getUserMedia) return 'This browser cannot use the camera here. Open TalentStream in Chrome or Safari.';
  const name = err instanceof DOMException ? err.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError')
    return 'Camera and microphone are blocked. Tap the lock icon next to the address, choose Permissions, allow Camera and Microphone, then try again.';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'No camera or microphone was found on this device.';
  if (name === 'NotReadableError') return 'Another app is using your camera or microphone. Close it, then try again.';
  return 'The camera or microphone could not be started.';
}

/** A one-to-one video call that runs inside TalentStream. The server only passes setup messages; the video goes directly between the two browsers. */
export default function MeetingRoom() {
  const { applicationId } = useParams();
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.token);
  const [details, setDetails] = useState<MeetingDetails | null>(null);
  const [loadError, setLoadError] = useState('');
  const [joined, setJoined] = useState(false);
  const [joining, setJoining] = useState(false);
  const [status, setStatus] = useState('');
  const [mediaNote, setMediaNote] = useState('');
  const [connected, setConnected] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [hasMic, setHasMic] = useState(false);
  const [hasCam, setHasCam] = useState(false);

  const localVideo = useRef<HTMLVideoElement>(null);
  const remoteVideo = useRef<HTMLVideoElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const pendingIce = useRef<RTCIceCandidateInit[]>([]);
  const leaving = useRef(false);

  const backPath = details?.role === 'employer' ? `/applicant/${applicationId}` : '/interview';

  const teardown = useCallback(() => {
    leaving.current = true;
    wsRef.current?.close();
    pcRef.current?.close();
    pcRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => teardown, [teardown]); // leaving the page ends the call

  // Load the meeting and check it again every 30 seconds: the room may open, or the interview may turn out to be missed
  useEffect(() => {
    if (!applicationId) return;
    let cancelled = false;
    const load = () =>
      fetchMeeting(applicationId)
        .then((d) => {
          if (cancelled) return;
          setDetails(d);
          if (d.state === 'missed' && wsRef.current) {
            // someone was waiting alone and the grace time ran out
            teardown();
            setJoined(false);
          }
        })
        .catch(() => !cancelled && setLoadError('We could not find this meeting. It may have been cancelled, or it belongs to someone else.'));
    load();
    const timer = setInterval(load, 30_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [applicationId, teardown]);


  const send = (type: string, data?: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send(JSON.stringify({ type, data }));
  };

  const createPeer = (iceServers: RTCIceServer[], otherName: string): RTCPeerConnection => {
    pcRef.current?.close();
    pendingIce.current = [];
    const pc = new RTCPeerConnection({ iceServers });
    const stream = streamRef.current;
    stream?.getTracks().forEach((t) => pc.addTrack(t, stream));
    // Someone without a camera or microphone can still see and hear the other person
    if (!stream?.getAudioTracks().length) pc.addTransceiver('audio', { direction: 'recvonly' });
    if (!stream?.getVideoTracks().length) pc.addTransceiver('video', { direction: 'recvonly' });
    pc.onicecandidate = (e) => e.candidate && send('ice', e.candidate.toJSON());
    pc.ontrack = (e) => {
      if (remoteVideo.current && e.streams[0]) remoteVideo.current.srcObject = e.streams[0];
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        setConnected(true);
        setStatus('');
      } else if (pc.connectionState === 'disconnected') {
        setStatus('The connection dropped. Trying to recover…');
      } else if (pc.connectionState === 'failed') {
        setConnected(false);
        setStatus(
          `We could not connect the call with ${otherName}. Some mobile networks block direct calls. Try Wi-Fi or another network, then leave and join again.`
        );
      }
    };
    pcRef.current = pc;
    return pc;
  };

  const handleSignal = async (msg: Signal, d: MeetingDetails) => {
    const flushIce = async (pc: RTCPeerConnection) => {
      for (const c of pendingIce.current.splice(0)) await pc.addIceCandidate(c).catch(() => undefined);
    };
    switch (msg.type) {
      case 'waiting':
        setStatus(`Waiting for ${d.other_name} to join…`);
        break;
      case 'peer-present':
        setStatus(`Connecting to ${d.other_name}…`);
        createPeer(d.ice_servers, d.other_name); // they will send the offer
        break;
      case 'peer-joined': {
        setStatus(`Connecting to ${d.other_name}…`);
        const pc = createPeer(d.ice_servers, d.other_name);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        send('offer', pc.localDescription);
        break;
      }
      case 'offer': {
        const pc = pcRef.current ?? createPeer(d.ice_servers, d.other_name);
        await pc.setRemoteDescription(msg.data as RTCSessionDescriptionInit);
        await flushIce(pc);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        send('answer', pc.localDescription);
        break;
      }
      case 'answer': {
        const pc = pcRef.current;
        if (pc) {
          await pc.setRemoteDescription(msg.data as RTCSessionDescriptionInit);
          await flushIce(pc);
        }
        break;
      }
      case 'ice': {
        const pc = pcRef.current;
        if (pc?.remoteDescription) await pc.addIceCandidate(msg.data as RTCIceCandidateInit).catch(() => undefined);
        else pendingIce.current.push(msg.data as RTCIceCandidateInit);
        break;
      }
      case 'peer-left':
        pcRef.current?.close();
        pcRef.current = null;
        if (remoteVideo.current) remoteVideo.current.srcObject = null;
        setConnected(false);
        setStatus(`${d.other_name} left. Waiting for them to come back…`);
        break;
      case 'replaced':
        setStatus('You joined this meeting from another tab or device, so the call moved there.');
        teardown();
        setJoined(false);
        break;
    }
  };

  const join = async () => {
    if (!details || !token || !applicationId) return;
    setJoining(true);
    leaving.current = false;

    // Camera and microphone if allowed, then microphone only, then neither (the person can still watch and listen)
    let stream: MediaStream | null = null;
    setMediaNote('');
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: { facingMode: 'user' } });
    } catch (cameraError) {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setMediaNote(`${mediaProblem(cameraError)} You joined with audio only.`);
      } catch (micError) {
        setMediaNote(`${mediaProblem(micError)} You can still see and hear the other person, but they cannot see or hear you.`);
      }
    }
    streamRef.current = stream;
    setHasMic(!!stream?.getAudioTracks().length);
    setHasCam(!!stream?.getVideoTracks().length);
    setMicOn(true);
    setCamOn(true);

    const ws = new WebSocket(`${buildWsUrl(`/ws/meeting/${applicationId}`)}?token=${encodeURIComponent(token)}`);
    wsRef.current = ws;
    ws.onmessage = (event) => {
      try {
        handleSignal(JSON.parse(event.data) as Signal, details).catch(() => setStatus('Something went wrong while connecting. Leave and join again.'));
      } catch {
        // ignore anything that isn't a setup message
      }
    };
    ws.onclose = (event) => {
      if (leaving.current) return;
      setConnected(false);
      setStatus(event.code === 1008 ? 'The meeting room is not open for you right now.' : 'You were disconnected from the meeting room. Leave and join again.');
    };
    setJoined(true);
    setJoining(false);
  };

  // The local preview is attached after the video element exists
  useEffect(() => {
    if (joined && localVideo.current && streamRef.current) localVideo.current.srcObject = streamRef.current;
  }, [joined, hasCam]);

  const toggle = (kind: 'audio' | 'video') => {
    const tracks = kind === 'audio' ? streamRef.current?.getAudioTracks() : streamRef.current?.getVideoTracks();
    const next = kind === 'audio' ? !micOn : !camOn;
    tracks?.forEach((t) => (t.enabled = next));
    if (kind === 'audio') setMicOn(next);
    else setCamOn(next);
  };

  const leave = () => {
    teardown();
    navigate(backPath);
  };

  if (loadError) {
    return (
      <div className="mx-auto max-w-lg space-y-4 text-center">
        <p className="rounded-xl border border-danger/30 bg-danger/10 p-4 text-sm text-text-primary">{loadError}</p>
        <Link to="/interview" className="inline-block py-2 font-semibold text-accent-primary hover:underline">
          Back to the Interview room
        </Link>
      </div>
    );
  }
  if (!details) return <Skeleton className="mx-auto h-64 w-full max-w-lg rounded-xl" />;

  if (details.state === 'missed' && !joined) {
    return (
      <div className="mx-auto max-w-lg space-y-4">
        <Link to={backPath} className="inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-text-secondary hover:text-text-primary">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <div className="space-y-3 rounded-xl border border-danger/40 bg-bg-surface p-4 shadow-sm sm:p-6" role="status">
          <h1 className="text-xl font-semibold text-text-primary">Interview missed</h1>
          <p className="text-sm text-text-secondary">
            {details.job_title} with {details.other_name}, {when(details.scheduled_at)}.
          </p>
          <p className="rounded-lg bg-bg-elevated p-3 text-sm text-text-primary">
            {missedMessage(details.role, details.absent, details.other_name)} The room closes 15 minutes after the start if someone has not joined.
          </p>
          <p className="text-sm text-text-secondary">{missedNextStep(details.role)}</p>
        </div>
      </div>
    );
  }

  if (!joined) {
    return (
      <div className="mx-auto max-w-lg space-y-4">
        <Link to={backPath} className="inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-text-secondary hover:text-text-primary">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <div className="space-y-3 rounded-xl border border-border-subtle bg-bg-surface p-4 shadow-sm sm:p-6">
          <div>
            <p className="text-sm text-text-secondary">Video interview with</p>
            <h1 className="text-xl font-semibold text-text-primary">{details.other_name}</h1>
            <p className="text-sm text-text-secondary">{details.job_title}</p>
          </div>
          <div className="rounded-lg bg-bg-elevated px-3 py-2 text-sm">
            <p className="font-semibold text-text-primary">{when(details.scheduled_at)}</p>
            {details.notes && <p className="mt-1 text-text-secondary">{details.notes}</p>}
          </div>

          {details.can_join_now ? (
            <>
              <ul className="list-disc space-y-1 pl-5 text-sm text-text-secondary">
                <li>Your browser will ask to use your camera and microphone. Choose Allow.</li>
                <li>Find a quiet spot with good light, and use Wi-Fi if you can.</li>
                <li>The call goes directly between you and {details.other_name}. TalentStream does not record it.</li>
              </ul>
              <Button onClick={join} loading={joining} className="w-full" size="lg">
                <Video className="mr-2 h-5 w-5" /> Join video interview
              </Button>
              {status && <p className="text-sm text-danger">{status}</p>}
            </>
          ) : (
            <p className="rounded-lg border border-border-subtle p-3 text-sm text-text-primary">
              {new Date(details.closes_at).getTime() < Date.now()
                ? 'This meeting has ended.'
                : `The room opens at ${new Date(details.opens_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}, 10 minutes before the start. This page checks automatically.`}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold text-text-primary sm:text-lg">{details.other_name}</h1>
          <p className="truncate text-xs text-text-secondary sm:text-sm">{details.job_title}</p>
        </div>
        <span className={`flex-shrink-0 rounded-md border px-2 py-1 text-xs font-semibold ${connected ? 'border-success/30 bg-success/10 text-success' : 'border-border-subtle text-text-secondary'}`}>
          {connected ? 'Connected' : 'Not connected yet'}
        </span>
      </div>

      <div className="relative min-h-[55dvh] overflow-hidden rounded-xl bg-black sm:aspect-video sm:min-h-0">
        <video ref={remoteVideo} autoPlay playsInline className="h-full w-full object-cover" />
        {!connected && (
          <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
            <p className="max-w-xs text-sm text-white/80" role="status">
              {status || 'Connecting…'}
            </p>
          </div>
        )}
        <video
          ref={localVideo}
          autoPlay
          muted
          playsInline
          aria-label="Your camera"
          className={`absolute bottom-3 right-3 w-24 rounded-lg border-2 border-white/70 bg-neutral-900 object-cover sm:w-40 ${hasCam && camOn ? '' : 'hidden'} [transform:scaleX(-1)]`}
        />
      </div>

      {mediaNote && (
        <div className="space-y-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-text-primary" role="alert">
          <p>{mediaNote}</p>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              teardown();
              setJoined(false);
              setConnected(false);
              setStatus('');
            }}
          >
            Fix it, then join again
          </Button>
        </div>
      )}
      {connected && status && <p className="text-sm text-text-secondary">{status}</p>}

      <div className="flex items-center justify-center gap-3">
        <Button variant={micOn ? 'secondary' : 'danger'} onClick={() => toggle('audio')} disabled={!hasMic} aria-label={micOn ? 'Mute microphone' : 'Unmute microphone'} className="gap-2">
          {micOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
          <span className="hidden sm:inline">{micOn ? 'Mute' : 'Unmute'}</span>
        </Button>
        <Button variant={camOn ? 'secondary' : 'danger'} onClick={() => toggle('video')} disabled={!hasCam} aria-label={camOn ? 'Turn camera off' : 'Turn camera on'} className="gap-2">
          {camOn ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
          <span className="hidden sm:inline">{camOn ? 'Camera off' : 'Camera on'}</span>
        </Button>
        <Button variant="danger" onClick={leave} aria-label="Leave the meeting" className="gap-2">
          <PhoneOff className="h-4 w-4" />
          Leave
        </Button>
      </div>
    </div>
  );
}
