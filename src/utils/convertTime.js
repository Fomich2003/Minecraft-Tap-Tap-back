        function has24HoursPassed(dateString) {
            const pastTime = new Date(dateString).getTime()
            const now = Date.now()

            const diffHours = (now - pastTime) / (1000 * 60 * 60)

            return diffHours >= 24
        }

        export default has24HoursPassed