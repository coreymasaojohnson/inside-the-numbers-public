<script lang="ts">
  export let title: string;
 // export let isOpen = true;         // kept for consistency, even though the button moved
 // export let onToggle: () => void = () => {};
</script>

<aside class="border-2 border-neutral-500 p-4 h-full">
  <div class="flex items-start justify-between gap-3 mb-2">
    <h2 class="text-lg sm:text-xl font-bold text-neutral-700 leading-snug">
  {title}
</h2>
    </div>
  <div class="text-sm leading-6 text-neutral-700 whitespace-pre-line">
    <slot />
  </div>
</aside>
