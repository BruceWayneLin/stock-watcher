<script setup>
const props = defineProps({
  news: { type: Array, required: true },
  symbol: { type: String, default: '' },
})

function timeAgo(ts) {
  const diff = Math.floor(Date.now() / 1000) - ts
  if (diff < 3600)  return Math.floor(diff / 60) + ' 分鐘前'
  if (diff < 86400) return Math.floor(diff / 3600) + ' 小時前'
  return Math.floor(diff / 86400) + ' 天前'
}
</script>

<template>
  <div class="bg-[#1a1d27] border border-gray-800 rounded-xl p-6">
    <p class="text-gray-400 text-sm font-semibold mb-4">
      📰 最新新聞
      <span v-if="symbol" class="text-gray-600 text-xs ml-2">{{ symbol }}</span>
    </p>

    <div v-if="!news.length" class="text-gray-600 text-xs">暫無相關新聞</div>

    <div v-else class="space-y-3">
      <a
        v-for="item in news"
        :key="item.id"
        :href="item.url"
        target="_blank"
        rel="noopener noreferrer"
        class="block bg-[#141620] border border-gray-800/50 rounded-lg p-3 hover:border-gray-700 transition-colors group"
      >
        <div class="flex gap-3">
          <div
            v-if="item.image"
            class="flex-shrink-0 w-16 h-16 rounded-md overflow-hidden bg-gray-800"
          >
            <img
              :src="item.image"
              :alt="item.headline"
              class="w-full h-full object-cover"
              loading="lazy"
              @error="$event.target.style.display='none'"
            />
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-gray-200 text-sm font-medium leading-snug group-hover:text-blue-400 transition-colors line-clamp-2">
              {{ item.headline }}
            </p>
            <p v-if="item.summary" class="text-gray-500 text-xs mt-1 line-clamp-2 leading-relaxed">
              {{ item.summary }}
            </p>
            <div class="flex items-center gap-2 mt-1.5">
              <span class="text-gray-600 text-[10px]">{{ item.source }}</span>
              <span class="text-gray-700 text-[10px]">·</span>
              <span class="text-gray-600 text-[10px]">{{ timeAgo(item.datetime) }}</span>
            </div>
          </div>
        </div>
      </a>
    </div>
  </div>
</template>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
