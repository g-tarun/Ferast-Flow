self.addEventListener('push', (event) => {
  const fallback = { title: 'FeastFlow update', body: 'There is a new marketplace update.', url: '/' }
  let payload = fallback

  try {
    payload = { ...fallback, ...(event.data ? event.data.json() : {}) }
  } catch {
    payload = fallback
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      data: { url: payload.url || '/' },
      tag: payload.tag || 'feastflow-update',
      renotify: true,
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = new URL(event.notification.data?.url || '/', self.location.origin).href

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existingClient = clients.find((client) => client.url.startsWith(self.location.origin))
      if (existingClient) {
        existingClient.navigate(targetUrl)
        return existingClient.focus()
      }
      return self.clients.openWindow(targetUrl)
    }),
  )
})
