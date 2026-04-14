<script setup>
import { ref } from 'vue'

const props = defineProps({
  news: { type: Array, required: true },
  symbol: { type: String, default: '' },
})

const expanded = ref({})

function toggle(id) {
  expanded.value[id] = !expanded.value[id]
}

function translateUrl(url) {
  if (!url) return '#'
  return `https://translate.google.com/translate?sl=en&tl=zh-TW&u=${encodeURIComponent(url)}`
}

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
      <div
        v-for="item in news"
        :key="item.id"
        class="bg-[#141620] border border-gray-800/50 rounded-lg overflow-hidden transition-colors"
        :class="expanded[item.id] ? 'border-gray-700' : 'hover:border-gray-700'"
      >
        <!-- 標題列（點擊展開） -->
        <div
          class="p-3 cursor-pointer select-none group"
          @click="toggle(item.id)"
        >
          <div class="flex gap-3">
            <div
              v-if="item.image"
              class="flex-shrink-0 w-16 h-16 rounded-md overflow-hidden bg-gray-800"
            >
              <img
                :src="item.image"
                :alt="item.headlineTw || item.headline"
                class="w-full h-full object-cover"
                loading="lazy"
                @error="$event.target.style.display='none'"
              />
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-gray-200 text-sm font-medium leading-snug group-hover:text-blue-400 transition-colors" :class="expanded[item.id] ? '' : 'line-clamp-2'">
                {{ item.headlineTw || item.headline }}
              </p>
              <div class="flex items-center gap-2 mt-1.5">
                <span class="text-gray-600 text-[10px]">{{ item.source }}</span>
                <span class="text-gray-700 text-[10px]">·</span>
                <span class="text-gray-600 text-[10px]">{{ timeAgo(item.datetime) }}</span>
                <span class="text-gray-700 text-[10px] ml-auto">{{ expanded[item.id] ? '收合 ▲' : '展開 ▼' }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 展開內容 -->
        <Transition
          enter-active-class="transition-all duration-200 ease-out"
          enter-from-class="opacity-0 max-h-0"
          enter-to-class="opacity-100 max-h-96"
          leave-active-class="transition-all duration-150 ease-in"
          leave-from-class="opacity-100 max-h-96"
          leave-to-class="opacity-0 max-h-0"
        >
          <div v-if="expanded[item.id]" class="overflow-hidden">
            <div class="px-3 pb-3 pt-0 border-t border-gray-800/50">
              <!-- 翻譯後摘要 -->
              <p v-if="item.summaryTw || item.summary" class="text-gray-400 text-xs mt-3 leading-relaxed">
                {{ item.summaryTw || item.summary }}
              </p>
              <p v-else class="text-gray-600 text-xs mt-3">此新聞無摘要內容</p>

              <!-- 原文標題（小字） -->
              <p v-if="item.headlineTw && item.headline !== item.headlineTw" class="text-gray-700 text-[10px] mt-2 italic">
                原文：{{ item.headline }}
              </p>

              <!-- 按鈕列 -->
              <div class="flex gap-2 mt-3">
                <a
                  :href="translateUrl(item.url)"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="inline-flex items-center gap-1 text-[11px] px-3 py-1.5 rounded-lg bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 transition-colors"
                  @click.stop
                >
                  📖 閱讀全文（中文版）
                </a>
                <a
                  :href="item.url"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="inline-flex items-center gap-1 text-[11px] px-3 py-1.5 rounded-lg bg-gray-500/10 text-gray-500 hover:bg-gray-500/20 transition-colors"
                  @click.stop
                >
                  原文連結
                </a>
              </div>
            </div>
          </div>
        </Transition>
      </div>
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
