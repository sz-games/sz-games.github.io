document.addEventListener('DOMContentLoaded', function () {
  const searchBox = document.getElementById('SearchBox')

  if (searchBox) {
    // Add event listener for the keyboard combination Ctrl/Cmd + K
    document.addEventListener('keydown', function (event) {
      // Check if Ctrl key (Windows/Linux) or Cmd key (Mac) is pressed along with K
      if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
        // Prevent the default browser behavior
        event.preventDefault()

        // Get the position of the search box
        const rect = searchBox.getBoundingClientRect()
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop
        const targetPosition = scrollTop + rect.top - 200 // 200px offset from the top

        // Smoothly scroll to the search box with offset
        window.scrollTo({
          top: targetPosition,
          behavior: 'smooth',
        })

        // Add a small delay before focusing to ensure the scroll completes
        setTimeout(function () {
          searchBox.focus()
        }, 500)
      }
    })
  }
})
