/**
 * Calculate worker productivity based on attendance data
 * @param {Array} attendanceData - Array of attendance records
 * @param {string} fromDate - Start date in YYYY-MM-DD format
 * @param {string} toDate - End date in YYYY-MM-DD format
 * @returns {Object} - Contains daily breakdown and totals
 */
export const calculateWorkerProductivity = (attendanceData, fromDate, toDate) => {
    // Standard working hours: 9 AM to 7 PM (10 hours total, 9 hours after lunch)
    const STANDARD_START_TIME = 9 * 60; // 9:00 AM in minutes
    const STANDARD_END_TIME = 19 * 60;   // 7:00 PM in minutes
    const LUNCH_DURATION = 60;           // 1 hour lunch break in minutes
    const STANDARD_WORKING_MINUTES = (STANDARD_END_TIME - STANDARD_START_TIME) - LUNCH_DURATION; // 540 minutes (9 hours)

    /**
     * Convert time string to minutes since midnight
     * @param {string} timeStr - Time in format "HH:MM:SS AM/PM"
     * @returns {number} - Minutes since midnight
     */
    function timeToMinutes(timeStr) {
        const [time, period] = timeStr.split(' ');
        const [hours, minutes, seconds] = time.split(':').map(Number);
        let totalMinutes = hours * 60 + minutes;
        
        if (period === 'PM' && hours !== 12) {
            totalMinutes += 12 * 60;
        } else if (period === 'AM' && hours === 12) {
            totalMinutes = minutes; // 12:XX AM is 00:XX
        }
        
        return totalMinutes;
    }

    /**
     * Convert minutes to HH:MM format
     * @param {number} minutes - Minutes to convert
     * @returns {string} - Time in HH:MM format
     */
    function minutesToTime(minutes) {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
    }

    /**
     * Get date string in YYYY-MM-DD format from ISO date
     * @param {string} isoDate - ISO date string
     * @returns {string} - Date in YYYY-MM-DD format
     */
    function getDateString(isoDate) {
        return new Date(isoDate).toISOString().split('T')[0];
    }

    /**
     * Generate array of dates between fromDate and toDate
     * @param {string} start - Start date in YYYY-MM-DD format
     * @param {string} end - End date in YYYY-MM-DD format
     * @returns {Array} - Array of date strings
     */
    function getDateRange(start, end) {
        const dates = [];
        const startDate = new Date(start);
        const endDate = new Date(end);
        
        for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
            dates.push(date.toISOString().split('T')[0]);
        }
        
        return dates;
    }

    // Get all dates in the range
    const dateRange = getDateRange(fromDate, toDate);
    
    // Group attendance data by date
    const attendanceByDate = {};
    attendanceData.forEach(record => {
        const recordDate = getDateString(record.date);
        if (!attendanceByDate[recordDate]) {
            attendanceByDate[recordDate] = [];
        }
        attendanceByDate[recordDate].push(record);
    });

    // Calculate productivity for each date
    const dailyResults = [];
    let totalPermissionMinutes = 0;
    let totalActualWorkingMinutes = 0;
    let totalPossibleWorkingMinutes = 0;

    dateRange.forEach(date => {
        const dayAttendance = attendanceByDate[date] || [];
        
        if (dayAttendance.length === 0) {
            // No attendance data for this date
            dailyResults.push({
                date: date,
                status: 'absent',
                permission_minutes: 0,
                actual_working_minutes: 0,
                standard_working_minutes: STANDARD_WORKING_MINUTES,
                first_punch_in: null,
                last_punch_out: null,
                total_punches: 0
            });
            totalPossibleWorkingMinutes += STANDARD_WORKING_MINUTES;
            return;
        }

        // Sort attendance records by time for the day
        const sortedAttendance = dayAttendance.sort((a, b) => 
            timeToMinutes(a.time) - timeToMinutes(b.time)
        );

        const firstPunchIn = timeToMinutes(sortedAttendance[0].time);
        const lastPunchOut = timeToMinutes(sortedAttendance[sortedAttendance.length - 1].time);

        // Calculate permission minutes (late arrival + early departure)
        let permissionMinutes = 0;
        
        // Late arrival: if came after 9:00 AM
        if (firstPunchIn > STANDARD_START_TIME) {
            permissionMinutes += firstPunchIn - STANDARD_START_TIME;
        }
        
        // Early departure: if left before 7:00 PM
        if (lastPunchOut < STANDARD_END_TIME) {
            permissionMinutes += STANDARD_END_TIME - lastPunchOut;
        }

        // Calculate actual working time
        // Only consider time between standard working hours (9 AM to 7 PM)
        const effectiveStartTime = Math.max(firstPunchIn, STANDARD_START_TIME);
        const effectiveEndTime = Math.min(lastPunchOut, STANDARD_END_TIME);
        
        let actualWorkingMinutes = 0;
        if (effectiveEndTime > effectiveStartTime) {
            actualWorkingMinutes = effectiveEndTime - effectiveStartTime - LUNCH_DURATION;
            // Ensure we don't have negative working time
            actualWorkingMinutes = Math.max(0, actualWorkingMinutes);
        }

        const dayResult = {
            date: date,
            status: 'present',
            permission_minutes: permissionMinutes,
            actual_working_minutes: actualWorkingMinutes,
            standard_working_minutes: STANDARD_WORKING_MINUTES,
            first_punch_in: sortedAttendance[0].time,
            last_punch_out: sortedAttendance[sortedAttendance.length - 1].time,
            first_punch_in_minutes: firstPunchIn,
            last_punch_out_minutes: lastPunchOut,
            total_punches: sortedAttendance.length,
            productivity_percentage: Math.round((actualWorkingMinutes / STANDARD_WORKING_MINUTES) * 100)
        };

        dailyResults.push(dayResult);
        
        totalPermissionMinutes += permissionMinutes;
        totalActualWorkingMinutes += actualWorkingMinutes;
        totalPossibleWorkingMinutes += STANDARD_WORKING_MINUTES;
    });

    // Calculate overall productivity metrics
    const totalDays = dateRange.length;
    const presentDays = dailyResults.filter(day => day.status === 'present').length;
    const absentDays = totalDays - presentDays;
    const overallProductivityPercentage = totalPossibleWorkingMinutes > 0 
        ? Math.round((totalActualWorkingMinutes / totalPossibleWorkingMinutes) * 100) 
        : 0;

    return {
        summary: {
            from_date: fromDate,
            to_date: toDate,
            total_days: totalDays,
            present_days: presentDays,
            absent_days: absentDays,
            total_permission_minutes: totalPermissionMinutes,
            total_actual_working_minutes: totalActualWorkingMinutes,
            total_possible_working_minutes: totalPossibleWorkingMinutes,
            total_permission_hours: minutesToTime(totalPermissionMinutes),
            total_actual_working_hours: minutesToTime(totalActualWorkingMinutes),
            total_possible_working_hours: minutesToTime(totalPossibleWorkingMinutes),
            overall_productivity_percentage: overallProductivityPercentage,
            average_daily_working_minutes: presentDays > 0 ? Math.round(totalActualWorkingMinutes / presentDays) : 0,
            average_daily_permission_minutes: presentDays > 0 ? Math.round(totalPermissionMinutes / presentDays) : 0
        },
        daily_breakdown: dailyResults
    };
}

// Example usage:
// const result = calculateWorkerProductivity(attendanceData, '2025-06-01', '2025-06-07');
// console.log(result);

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = calculateWorkerProductivity;
}