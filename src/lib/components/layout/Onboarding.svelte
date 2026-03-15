<script lang="ts">
  import { completeOnboarding } from '$lib/stores/onboarding.svelte';
  import { Music, Search, Heart, ListMusic, Keyboard, ArrowRight } from 'lucide-svelte';

  let currentStep = $state(0);
  let isClosing = $state(false);

  const steps = [
    {
      title: 'Welcome to SpotyCloud',
      subtitle: 'Your personal SoundCloud desktop player',
      description: 'Stream millions of tracks, create playlists, and enjoy music — all from your desktop.',
      icon: 'logo',
    },
    {
      title: 'Connect to SoundCloud',
      subtitle: 'One-time setup',
      description: 'To stream music, you\'ll need a SoundCloud Client ID. Don\'t worry — we\'ll guide you through getting one in Settings.',
      icon: 'key',
    },
    {
      title: 'Search & Discover',
      subtitle: 'Find any track',
      description: 'Search for any song, artist, or genre on SoundCloud. Browse categories or type in the search bar.',
      icon: 'search',
    },
    {
      title: 'Your Library',
      subtitle: 'Playlists & Liked Songs',
      description: 'Like tracks to save them, create custom playlists, and organize your music collection your way.',
      icon: 'library',
    },
    {
      title: 'You\'re all set!',
      subtitle: 'Let\'s get started',
      description: 'Head to Settings to connect your SoundCloud account, then start exploring.',
      icon: 'ready',
    },
  ];

  function dismiss() {
    isClosing = true;
    setTimeout(() => {
      completeOnboarding();
    }, 400);
  }

  function next() {
    if (currentStep < steps.length - 1) {
      currentStep++;
    } else {
      dismiss();
    }
  }

  function skip() {
    dismiss();
  }
</script>

<div class="onboarding-overlay" class:closing={isClosing}>
  <div class="onboarding-container">
    <!-- Skip button -->
    <button class="skip-btn" onclick={skip}>
      Skip intro
    </button>

    <!-- Step content -->
    <div class="step-content">
      <!-- Icon -->
      <div class="step-icon">
        {#if steps[currentStep].icon === 'logo'}
          <div class="icon-circle icon-green">
            <svg class="w-12 h-12 text-black" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 3v9.28c-.47-.17-.97-.28-1.5-.28C8.01 12 6 14.01 6 16.5S8.01 21 10.5 21c2.31 0 4.2-1.75 4.45-4H15V6h4V3h-7z"/>
            </svg>
          </div>
        {:else if steps[currentStep].icon === 'key'}
          <div class="icon-circle icon-orange">
            <Keyboard class="w-10 h-10 text-black" />
          </div>
        {:else if steps[currentStep].icon === 'search'}
          <div class="icon-circle icon-blue">
            <Search class="w-10 h-10 text-black" />
          </div>
        {:else if steps[currentStep].icon === 'library'}
          <div class="icon-circle icon-purple">
            <ListMusic class="w-10 h-10 text-white" />
          </div>
        {:else}
          <div class="icon-circle icon-green">
            <ArrowRight class="w-10 h-10 text-black" />
          </div>
        {/if}
      </div>

      <!-- Text -->
      <div class="step-text">
        <p class="step-subtitle">{steps[currentStep].subtitle}</p>
        <h1 class="step-title">{steps[currentStep].title}</h1>
        <p class="step-description">{steps[currentStep].description}</p>
      </div>

      <!-- Features list on first step -->
      {#if currentStep === 0}
        <div class="features-grid">
          <div class="feature-item">
            <Search class="w-5 h-5 text-[#1db954]" />
            <span>Search tracks</span>
          </div>
          <div class="feature-item">
            <Heart class="w-5 h-5 text-[#1db954]" />
            <span>Like songs</span>
          </div>
          <div class="feature-item">
            <ListMusic class="w-5 h-5 text-[#1db954]" />
            <span>Create playlists</span>
          </div>
          <div class="feature-item">
            <Music class="w-5 h-5 text-[#1db954]" />
            <span>Stream music</span>
          </div>
        </div>
      {/if}
    </div>

    <!-- Bottom controls -->
    <div class="step-controls">
      <!-- Dots -->
      <div class="step-dots">
        {#each steps as _, i}
          <button
            class="dot"
            class:dot-active={i === currentStep}
            class:dot-done={i < currentStep}
            onclick={() => currentStep = i}
            aria-label="Go to step {i + 1}"
          ></button>
        {/each}
      </div>

      <!-- Next / Get Started button -->
      <button class="next-btn" onclick={next}>
        {#if currentStep === steps.length - 1}
          Get Started
        {:else}
          Next
        {/if}
        <ArrowRight class="w-4 h-4" />
      </button>
    </div>
  </div>
</div>

<style>
  .onboarding-overlay {
    position: fixed;
    inset: 0;
    z-index: 9999;
    background: rgba(0, 0, 0, 0.85);
    backdrop-filter: blur(20px);
    display: flex;
    align-items: center;
    justify-content: center;
    animation: fade-in 0.4s ease;
    transition: opacity 0.4s ease, transform 0.4s ease;
  }

  .onboarding-overlay.closing {
    opacity: 0;
    transform: scale(1.02);
    pointer-events: none;
  }

  @keyframes fade-in {
    from { opacity: 0; transform: scale(0.98); }
    to { opacity: 1; transform: scale(1); }
  }

  .onboarding-container {
    position: relative;
    width: 100%;
    max-width: 520px;
    padding: 48px 40px 36px;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
  }

  .skip-btn {
    position: absolute;
    top: 0;
    right: 0;
    color: #6a6a6a;
    font-size: 13px;
    font-weight: 500;
    padding: 8px 16px;
    border-radius: 20px;
    transition: color 0.2s, background 0.2s;
  }

  .skip-btn:hover {
    color: #fff;
    background: rgba(255, 255, 255, 0.07);
  }

  .step-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    animation: step-in 0.3s ease;
  }

  @keyframes step-in {
    from { opacity: 0; transform: translateY(12px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .step-icon {
    margin-bottom: 28px;
  }

  .icon-circle {
    width: 96px;
    height: 96px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
  }

  .icon-green {
    background: linear-gradient(135deg, #1db954 0%, #1ed760 100%);
  }

  .icon-orange {
    background: linear-gradient(135deg, #ff6b35 0%, #ffa42b 100%);
  }

  .icon-blue {
    background: linear-gradient(135deg, #1e90ff 0%, #63b3ed 100%);
  }

  .icon-purple {
    background: linear-gradient(135deg, #4520a0 0%, #7b5fc7 100%);
  }

  .step-text {
    margin-bottom: 24px;
  }

  .step-subtitle {
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #1db954;
    margin-bottom: 8px;
  }

  .step-title {
    font-size: 32px;
    font-weight: 900;
    color: #fff;
    line-height: 1.1;
    margin-bottom: 12px;
  }

  .step-description {
    font-size: 15px;
    color: #b3b3b3;
    line-height: 1.5;
    max-width: 400px;
  }

  .features-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    width: 100%;
    max-width: 320px;
    margin-bottom: 8px;
  }

  .feature-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 16px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 8px;
    color: #e0e0e0;
    font-size: 13px;
    font-weight: 500;
  }

  .step-controls {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 24px;
    margin-top: 32px;
    width: 100%;
  }

  .step-dots {
    display: flex;
    gap: 8px;
  }

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #3e3e3e;
    transition: background 0.2s, transform 0.2s;
  }

  .dot:hover {
    background: #6a6a6a;
  }

  .dot-active {
    background: #fff;
    transform: scale(1.2);
  }

  .dot-done {
    background: #1db954;
  }

  .next-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 14px 32px;
    background: #fff;
    color: #000;
    font-weight: 700;
    font-size: 15px;
    border-radius: 50px;
    transition: transform 0.15s, background 0.15s;
  }

  .next-btn:hover {
    transform: scale(1.04);
    background: #e0e0e0;
  }
</style>
