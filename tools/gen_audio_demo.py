#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
程序化合成《魔女试炼》BGM demo + 音效 demo（8bit / 清新星光像素风）。
不依赖任何外部素材下载，纯 numpy 合成，方便快速试听调风格。
"""
import numpy as np
import wave
import struct
import os

SR = 44100

# ---------- 基础合成工具 ----------

def _env(n, attack, release, sr=SR):
    env = np.ones(n)
    a = int(sr * attack)
    r = int(sr * release)
    if a > 0:
        a = min(a, n)
        env[:a] = np.linspace(0, 1, a)
    if r > 0:
        r = min(r, n)
        env[-r:] = np.linspace(1, 0, r)
    return env


def tone(freq, dur, wave_type="square", vol=0.3, attack=0.008, release=0.03,
          pitch_end=None, vibrato_hz=0, vibrato_depth=0, sr=SR):
    n = max(1, int(sr * dur))
    t = np.arange(n) / sr
    if pitch_end is not None:
        freq_arr = np.linspace(freq, pitch_end, n)
    else:
        freq_arr = np.full(n, float(freq))
    if vibrato_hz > 0:
        freq_arr = freq_arr + vibrato_depth * np.sin(2 * np.pi * vibrato_hz * t)
    phase = 2 * np.pi * np.cumsum(freq_arr) / sr
    if wave_type == "sine":
        w = np.sin(phase)
    elif wave_type == "square":
        w = np.sign(np.sin(phase))
    elif wave_type == "triangle":
        w = 2 / np.pi * np.arcsin(np.sin(phase))
    elif wave_type == "saw":
        ph = phase / (2 * np.pi)
        w = 2 * (ph - np.floor(ph + 0.5))
    else:
        w = np.sin(phase)
    return w * _env(n, attack, release, sr) * vol


def noise(dur, vol=0.2, attack=0.001, release=0.05, lowpass=None, sr=SR):
    n = max(1, int(sr * dur))
    w = np.random.uniform(-1, 1, n)
    if lowpass:
        k = max(1, int(sr / lowpass))
        kernel = np.ones(k) / k
        w = np.convolve(w, kernel, mode="same")
    return w * _env(n, attack, release, sr) * vol


def silence(dur, sr=SR):
    return np.zeros(max(0, int(sr * dur)))


def mix(*tracks):
    n = max(len(t) for t in tracks) if tracks else 0
    out = np.zeros(n)
    for t in tracks:
        out[: len(t)] += t
    return out


def concat(*tracks):
    return np.concatenate(tracks) if tracks else np.zeros(0)


def place(canvas, track, start_sample):
    end = start_sample + len(track)
    if end > len(canvas):
        canvas = np.concatenate([canvas, np.zeros(end - len(canvas))])
    canvas[start_sample:end] += track
    return canvas


def normalize(samples, peak=0.9):
    m = np.max(np.abs(samples)) if len(samples) else 0
    if m > 1e-6:
        samples = samples / m * peak
    return samples


def write_wav(path, samples, sr=SR):
    samples = normalize(samples)
    ints = np.clip(samples * 32767, -32768, 32767).astype(np.int16)
    with wave.open(path, "w") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sr)
        wf.writeframes(ints.tobytes())
    print(f"[ok] {path}  {len(samples)/sr:.2f}s")


# ---------- 音符频率表 ----------
NOTE = {
    "C4": 261.63, "D4": 293.66, "E4": 329.63, "F4": 349.23, "G4": 392.00,
    "A4": 440.00, "B4": 493.88,
    "C5": 523.25, "D5": 587.33, "E5": 659.25, "F5": 698.46, "G5": 783.99,
    "A5": 880.00, "B5": 987.77,
    "C6": 1046.50, "D6": 1174.66, "E6": 1318.51, "G6": 1567.98,
}

# ================= BGM：森林热闹感 8bit loop =================
# 96 BPM，C - Am - F - G 进行，循环两遍（8 小节），可无缝复读
# 用三角波替代方波主旋律（更柔和不刺耳），去掉硬镲片/硬底鼓，
# 加入木鱼式轻打击 + 随机高音鸟鸣滑音 + 低量风吹叶底噪，营造森林热闹氛围


def build_bgm():
    bpm = 96
    beat = 60 / bpm
    step = beat / 4  # 16分音符
    chords = [
        ("C5", "E5", "G5"),
        ("A4", "C5", "E5"),
        ("F4", "A4", "C5"),
        ("G4", "B4", "D5"),
    ] * 2  # 循环两遍，8 小节

    total_steps = len(chords) * 16
    total_len = int(total_steps * step * SR) + SR
    canvas = np.zeros(total_len)

    arp_pattern = [0, 1, 2, 1] * 4  # 每和弦 16 步的琶音走位
    rng = np.random.default_rng(42)  # 固定种子，保证鸟鸣位置可复现
    bird_freqs = [1567.98, 1760.0, 1975.53, 2093.00, 2349.32]

    for ci, chord in enumerate(chords):
        chord_start_step = ci * 16
        root_name = chord[0]
        bass_freq = NOTE[root_name] / 2  # 低八度作为 bass

        for s in range(16):
            t0 = (chord_start_step + s) * step
            start_sample = int(t0 * SR)

            # 琶音主旋律：三角波，柔和不刺耳，像木笛/口风琴
            note_name = chord[arp_pattern[s]]
            freq = NOTE[note_name]
            mel = tone(freq, step * 0.9, wave_type="triangle", vol=0.20,
                       attack=0.006, release=step * 0.4)
            canvas = place(canvas, mel, start_sample)

            # Bass：每 4 步（一拍）落一次三角波根音，音量略降更松弛
            if s % 4 == 0:
                b = tone(bass_freq, beat * 0.85, wave_type="triangle", vol=0.20,
                          attack=0.004, release=beat * 0.35)
                canvas = place(canvas, b, start_sample)

            # 轻打击：用短促三角波替代刺耳噪声镲片，像木鱼/拨弦，重拍稍强
            perc_vol = 0.05 if s % 4 == 0 else 0.03
            perc = tone(bass_freq * 2, 0.04, wave_type="triangle", vol=perc_vol,
                        attack=0.001, release=0.03)
            canvas = place(canvas, perc, start_sample)

            # 偶尔的高音鸟鸣滑音，营造森林里此起彼伏的热闹感
            if rng.random() < 0.12:
                cf = float(rng.choice(bird_freqs))
                chirp = tone(cf, 0.05, wave_type="sine", vol=0.09,
                              attack=0.002, release=0.04,
                              pitch_end=cf * 1.15, vibrato_hz=25, vibrato_depth=40)
                canvas = place(canvas, chirp, start_sample)

    # 持续的森林底噪（风吹叶动），音量很低、重低通，增加空间感但不抢戏
    amb = noise(total_len / SR, vol=0.02, attack=1.0, release=1.0, lowpass=1200)
    canvas = mix(canvas, amb[: len(canvas)] if len(amb) >= len(canvas)
                 else np.concatenate([amb, np.zeros(len(canvas) - len(amb))]))

    return canvas


# ================= 菜单 BGM：安静悠闲、呼应"星光"主题 =================
# 78 BPM，比关卡BGM更慢更稀疏，三角波长垫底 + 悠闲旋律 + 偶尔星光闪烁高音
# 约12s，循环播放不会腻


def build_menu_bgm():
    bpm = 78
    beat = 60 / bpm
    step = beat / 2  # 用8分音符为步进单位，比关卡BGM的16分音符更悠闲
    chords = [
        ("C5", "E5", "G5"),
        ("F4", "A4", "C5"),
        ("G4", "B4", "D5"),
        ("A4", "C5", "E5"),
    ]  # 4小节一循环，接入游戏时整段 loop 播放

    total_steps = len(chords) * 8
    total_len = int(total_steps * step * SR) + SR
    canvas = np.zeros(total_len)

    melody_pattern = [0, 1, 2, 1, 0, 2, 1, 0]  # 每小节8步的悠闲旋律走位
    rng = np.random.default_rng(7)
    sparkle_freqs = [1046.50, 1174.66, 1318.51, 1567.98]

    for ci, chord in enumerate(chords):
        chord_start_step = ci * 8
        root_name = chord[0]
        pad_freq = NOTE[root_name] / 2

        # 柔长的三角波和弦垫底，营造安静等待/邀请感
        pad = tone(pad_freq, step * 7.5, wave_type="triangle", vol=0.13,
                   attack=0.25, release=1.2)
        canvas = place(canvas, pad, int(chord_start_step * step * SR))

        for s in range(8):
            t0 = (chord_start_step + s) * step
            start_sample = int(t0 * SR)
            note_name = chord[melody_pattern[s] % len(chord)]
            freq = NOTE[note_name]
            mel = tone(freq, step * 0.85, wave_type="triangle", vol=0.16,
                       attack=0.01, release=step * 0.5)
            canvas = place(canvas, mel, start_sample)

            # 偶尔的星光闪烁高音，呼应游戏"星光"主题，不打扰安静感
            if rng.random() < 0.18:
                sf = float(rng.choice(sparkle_freqs))
                spark = tone(sf, 0.12, wave_type="sine", vol=0.07,
                              attack=0.005, release=0.1, vibrato_hz=6, vibrato_depth=6)
                canvas = place(canvas, spark, start_sample)

    return canvas


# ================= SFX =================

def sfx_collect_star():
    # 清脆上升三音，星光收集的感觉
    a = tone(NOTE["C6"], 0.06, wave_type="square", vol=0.35, attack=0.002, release=0.03)
    b = tone(NOTE["E6"], 0.06, wave_type="square", vol=0.35, attack=0.002, release=0.03)
    c = tone(NOTE["G6"], 0.10, wave_type="square", vol=0.35, attack=0.002, release=0.07)
    return concat(a, b, c)


def sfx_collect_potion():
    # 药水：略带水泡感的滑音 + 轻微颤音
    t = tone(520, 0.16, wave_type="triangle", vol=0.3, attack=0.004, release=0.1,
              pitch_end=760, vibrato_hz=18, vibrato_depth=12)
    return t


def pad_to(track, n):
    if len(track) >= n:
        return track[:n]
    return np.concatenate([track, np.zeros(n - len(track))])


def sfx_rarestar():
    # 稀有六芒星：更华丽的五音上升琶音 + 尾部闪光噪声
    notes = ["C6", "D6", "E6", "G6", "C6"]
    parts = []
    for i, n in enumerate(notes):
        parts.append(tone(NOTE[n] * (2 if i == len(notes) - 1 else 1), 0.07,
                            wave_type="square", vol=0.32, attack=0.002, release=0.045))
    arp = concat(*parts)
    sparkle = noise(0.35, vol=0.10, attack=0.02, release=0.3, lowpass=9000)
    return mix(arp, pad_to(sparkle, len(arp)))


def sfx_hit():
    # 撞击受伤：短促噪声 + 下滑闷响，卡通感而非血腥感
    thump = tone(210, 0.16, wave_type="sine", vol=0.4, attack=0.001, release=0.14, pitch_end=70)
    crack = noise(0.06, vol=0.22, attack=0.001, release=0.05, lowpass=4000)
    return mix(thump, pad_to(crack, len(thump)))


def sfx_button_click():
    # 通用按钮点触音效：短促清脆的上滑"啵"声 + 极短触感噪声，干净不刺耳
    body = tone(760, 0.05, wave_type="square", vol=0.24, attack=0.001, release=0.04,
                pitch_end=1200)
    tick = noise(0.015, vol=0.07, attack=0.0005, release=0.012, lowpass=8000)
    return mix(body, pad_to(tick, len(body)))


def sfx_death():
    # 死亡/结算：先来一声卡通"womp womp"下滑（滑稽认输感），
    # 紧接一句昂扬的上升号角式动机，营造"我一定会回来的！"再接再厉感
    womp1 = tone(NOTE["A4"], 0.20, wave_type="triangle", vol=0.30, attack=0.004, release=0.05,
                  pitch_end=NOTE["F4"])
    womp2 = tone(NOTE["F4"], 0.32, wave_type="triangle", vol=0.28, attack=0.004, release=0.2,
                  pitch_end=NOTE["D4"], vibrato_hz=7, vibrato_depth=10)
    womp = concat(womp1, womp2)

    comeback_notes = ["C5", "E5", "G5", "C6"]
    parts = []
    for i, n in enumerate(comeback_notes):
        dur = 0.09 if i < len(comeback_notes) - 1 else 0.24
        parts.append(tone(NOTE[n], dur, wave_type="square", vol=0.34,
                            attack=0.003, release=dur * 0.4))
    comeback = concat(*parts)

    return concat(womp, silence(0.1), comeback)


# ================= 主流程：拼接 demo 时间线 =================

def main():
    out_dir = os.path.join(os.path.dirname(__file__), "..", "assets", "audio_demo")
    out_dir = os.path.abspath(out_dir)
    os.makedirs(out_dir, exist_ok=True)

    bgm = build_bgm()
    menu_bgm = build_menu_bgm()
    c_star = sfx_collect_star()
    c_potion = sfx_collect_potion()
    c_rare = sfx_rarestar()
    c_hit = sfx_hit()
    c_death = sfx_death()
    c_click = sfx_button_click()

    # 单独导出每个素材（后续正式接入游戏时会用到）
    write_wav(os.path.join(out_dir, "bgm_demo.wav"), bgm)
    write_wav(os.path.join(out_dir, "menu_bgm_demo.wav"), menu_bgm)
    write_wav(os.path.join(out_dir, "sfx_collect_star.wav"), c_star)
    write_wav(os.path.join(out_dir, "sfx_collect_potion.wav"), c_potion)
    write_wav(os.path.join(out_dir, "sfx_rarestar.wav"), c_rare)
    write_wav(os.path.join(out_dir, "sfx_hit.wav"), c_hit)
    write_wav(os.path.join(out_dir, "sfx_death.wav"), c_death)
    write_wav(os.path.join(out_dir, "sfx_button_click.wav"), c_click)

    # 拼接成一份可顺序试听的 demo 时间线，并打印时间戳方便对照
    timeline = []
    cursor = 0.0

    def add(label, track, gap_after=0.8):
        nonlocal cursor
        timeline.append((cursor, label))
        cursor += len(track) / SR + gap_after
        return track

    segs = []
    segs.append(add("关卡BGM 完整试听（约20s，可循环）", bgm, gap_after=1.0))
    segs.append(silence(1.0))
    segs.append(add("菜单BGM 完整试听（约12s，可循环）", menu_bgm, gap_after=1.0))
    segs.append(silence(1.0))
    segs.append(add("通用按钮点触音效 x3", concat(c_click, silence(0.25), c_click, silence(0.25), c_click)))
    segs.append(silence(0.4))
    segs.append(add("收集-普通星星 x2", concat(c_star, silence(0.35), c_star)))
    segs.append(silence(0.4))
    segs.append(add("收集-魔法药水 x2", concat(c_potion, silence(0.35), c_potion)))
    segs.append(silence(0.4))
    segs.append(add("稀有六芒星 x2", concat(c_rare, silence(0.4), c_rare)))
    segs.append(silence(0.4))
    segs.append(add("撞击受伤 x2", concat(c_hit, silence(0.35), c_hit)))
    segs.append(silence(0.4))
    segs.append(add("死亡/结算 x1", c_death, gap_after=0.5))

    demo_all = concat(*segs)
    write_wav(os.path.join(out_dir, "demo_all.wav"), demo_all)

    print("\n===== 试听时间戳 =====")
    for t, label in timeline:
        mm = int(t // 60)
        ss = t % 60
        print(f"{mm:02d}:{ss:05.2f}  {label}")


if __name__ == "__main__":
    main()
