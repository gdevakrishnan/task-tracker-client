export const calculateWorkerProductivity = (productivityParameters) => {
  const {
    attendanceData,
    fromDate,
    toDate,
    options = {}
  } = productivityParameters;

  const {
    considerOvertime = false,
    deductSalary = true,
    permissionTimeMinutes = 15,
    salaryDeductionPerBreak = 10,
    batches = [],
    lunchFrom = '12:00',
    lunchTo = '13:00',
    intervals = [],
    fiteredBatch = 'Full Time',
    isLunchConsider = false,
    holidays = [] // New parameter for holidays
  } = options;

  const timeToMinutes = (timeStr) => {
    if (!timeStr) return 0;
    const parts = timeStr.split(':').map(Number);
    const hours = parts[0] || 0;
    const minutes = parts[1] || 0;
    const seconds = parts[2] || 0;
    return hours * 60 + minutes + seconds / 60;
  };

  const minutesToTime = (totalMinutes) => {
    const totalSeconds = Math.round(totalMinutes * 60);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const parseAttendanceTime = (timeStr) => {
    if (!timeStr) return 0;
    const [time, period] = timeStr.split(' ');
    const [hours, minutes, seconds = 0] = time.split(':').map(Number);

    let totalSeconds = seconds + (minutes * 60) + (hours * 3600);

    if (period === 'AM') {
      if (hours === 12) totalSeconds -= 12 * 3600; // 12 AM = 0 hours
    } else if (period === 'PM') {
      if (hours !== 12) totalSeconds += 12 * 3600; // Add 12 hours for PM (except 12 PM)
    }

    // Return total minutes with seconds as decimal
    return totalSeconds / 60;
  };

  const formatTime = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = Math.floor(minutes % 60);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
    return `${displayHours}:${mins.toString().padStart(2, '0')} ${period}`;
  };

  const formatCurrency = (amount) => {
    return `₹${amount.toFixed(2)}`;
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    const day = date.getDate();
    const month = date.toLocaleString('default', { month: 'long' });
    return `${day.toString().padStart(2, '0')} ${month}`;
  };

  const isSunday = (date) => {
    const day = new Date(date);
    return day.getDay() === 0;
  };

  // New function to check if date is a holiday
  const isHoliday = (date) => {
    if (!holidays || holidays.length === 0) return null;

    const dateStr = new Date(date).toISOString().split('T')[0];
    const holiday = holidays.find(h => {
      const holidayDate = new Date(h.date).toISOString().split('T')[0];
      return holidayDate === dateStr;
    });

    return holiday || null;
  };

  const generateDateRange = (fromDate, toDate) => {
    const dates = [];
    const currentDate = new Date(fromDate);
    const endDate = new Date(toDate);

    while (currentDate <= endDate) {
      dates.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return dates;
  };

  const countSundaysInRange = (fromDate, toDate) => {
    const dates = generateDateRange(fromDate, toDate);
    return dates.filter(date => isSunday(date)).length;
  };

  // Enhanced function to calculate working time with detailed breakdown
  const calculateWorkingTimeDetailed = (punches, workStart, workEnd) => {
    if (punches.length === 0) return { totalWorkingMinutes: 0, intervals: [], deductions: [] };

    let totalWorkingMinutes = 0;
    let intervalDetails = [];
    let deductionDetails = [];

    console.log('Calculating detailed working time for punches:', punches.map(p => ({
      time: p.originalTime,
      minutes: p.time,
      status: p.record.status || p.record.presence || p.record.type || 'Unknown'
    })));

    // Process all IN→OUT intervals
    for (let i = 0; i < punches.length - 1; i++) {
      let currentStatus = punches[i].record.status ||
        punches[i].record.presence ||
        punches[i].record.type ||
        punches[i].record.Presence ||
        punches[i].record.STATUS;

      let nextStatus = punches[i + 1].record.status ||
        punches[i + 1].record.presence ||
        punches[i + 1].record.type ||
        punches[i + 1].record.Presence ||
        punches[i + 1].record.STATUS;

      // If no status found, assume alternating pattern starting with IN
      if (!currentStatus || !nextStatus) {
        currentStatus = i % 2 === 0 ? 'IN' : 'OUT';
        nextStatus = (i + 1) % 2 === 0 ? 'IN' : 'OUT';
      }

      if (currentStatus === 'IN' && nextStatus === 'OUT') {
        let intervalStart = Math.max(punches[i].time, workStart);
        let intervalEnd = Math.min(punches[i + 1].time, workEnd);

        if (intervalEnd > intervalStart) {
          let rawWorkingInterval = intervalEnd - intervalStart;
          let finalWorkingInterval = rawWorkingInterval;
          let intervalDeductions = [];

          // Track lunch deduction for this interval
          if (!isLunchConsider) {
            const lunchStart = timeToMinutes(lunchFrom);
            const lunchEnd = timeToMinutes(lunchTo);

            if (intervalStart < lunchEnd && intervalEnd > lunchStart) {
              const lunchOverlap = Math.min(intervalEnd, lunchEnd) - Math.max(intervalStart, lunchStart);
              finalWorkingInterval -= Math.max(0, lunchOverlap);
              intervalDeductions.push({
                type: 'Lunch',
                deductedMinutes: lunchOverlap,
                reason: 'Lunch break deduction'
              });
            }
          }

          // Track break deductions for this interval
          intervals.forEach((interval, idx) => {
            if (!interval.isBreakConsider) {
              const breakStart = timeToMinutes(interval.from);
              const breakEnd = timeToMinutes(interval.to);

              if (intervalStart < breakEnd && intervalEnd > breakStart) {
                const breakOverlap = Math.min(intervalEnd, breakEnd) - Math.max(intervalStart, breakStart);
                finalWorkingInterval -= Math.max(0, breakOverlap);
                intervalDeductions.push({
                  type: `Break ${idx + 1}`,
                  deductedMinutes: breakOverlap,
                  reason: `Break interval ${interval.from} - ${interval.to}`
                });
              }
            }
          });

          intervalDetails.push({
            intervalNumber: i + 1,
            inTime: formatTime(punches[i].time),
            outTime: formatTime(punches[i + 1].time),
            rawMinutes: rawWorkingInterval,
            finalMinutes: Math.max(0, finalWorkingInterval),
            deductions: intervalDeductions,
            totalDeducted: rawWorkingInterval - Math.max(0, finalWorkingInterval)
          });

          deductionDetails.push(...intervalDeductions);
          totalWorkingMinutes += Math.max(0, finalWorkingInterval);
        }
      }
    }

    // Handle overtime consideration
    if (!considerOvertime) {
      const standardWorkTime = workEnd - workStart;
      let expectedWorkTime = standardWorkTime;

      // Subtract lunch from expected work time if not considered
      if (!isLunchConsider) {
        expectedWorkTime -= (timeToMinutes(lunchTo) - timeToMinutes(lunchFrom));
      }

      // Subtract intervals from expected work time if not considered
      intervals.forEach(interval => {
        if (!interval.isBreakConsider) {
          expectedWorkTime -= (timeToMinutes(interval.to) - timeToMinutes(interval.from));
        }
      });

      if (totalWorkingMinutes > expectedWorkTime) {
        const overtimeMinutes = totalWorkingMinutes - expectedWorkTime;
        deductionDetails.push({
          type: 'Overtime Exclusion',
          deductedMinutes: overtimeMinutes,
          reason: 'Overtime not considered in calculations'
        });
        totalWorkingMinutes = expectedWorkTime;
      }
    }

    return {
      totalWorkingMinutes: Math.max(0, totalWorkingMinutes),
      intervals: intervalDetails,
      deductions: deductionDetails
    };
  };

  // Enhanced permission time calculation with detailed breakdown
  const calculatePermissionTimeDetailed = (punches, workStart, workEnd) => {
    if (punches.length === 0) return { totalPermissionMinutes: 0, details: [] };

    const firstPunch = punches[0];
    const lastPunch = punches[punches.length - 1];
    let permissionDetails = [];
    let totalPermissionMinutes = 0;

    // Late arrival
    if (firstPunch.time > workStart) {
      const lateMinutes = firstPunch.time - workStart;
      const permissionUsed = Math.min(lateMinutes, permissionTimeMinutes);
      const excessMinutes = Math.max(0, lateMinutes - permissionTimeMinutes);

      permissionDetails.push({
        type: 'Late Arrival',
        totalMinutes: lateMinutes,
        permissionUsed: permissionUsed,
        excessMinutes: excessMinutes,
        description: `Arrived ${Math.round(lateMinutes)} minutes late`
      });

      totalPermissionMinutes += lateMinutes;
    }

    // Early departure (only if there's an OUT punch)
    if (punches.length > 1 && lastPunch.time < workEnd) {
      const earlyMinutes = workEnd - lastPunch.time;
      const permissionUsed = Math.min(earlyMinutes, permissionTimeMinutes);
      const excessMinutes = Math.max(0, earlyMinutes - permissionTimeMinutes);

      permissionDetails.push({
        type: 'Early Departure',
        totalMinutes: earlyMinutes,
        permissionUsed: permissionUsed,
        excessMinutes: excessMinutes,
        description: `Left ${Math.round(earlyMinutes)} minutes early`
      });

      totalPermissionMinutes += earlyMinutes;
    }

    return {
      totalPermissionMinutes,
      details: permissionDetails
    };
  };

  const isSingleDay = new Date(fromDate).toDateString() === new Date(toDate).toDateString();

  const selectedBatch = batches.find(batch => batch.batchName === fiteredBatch);
  const workStartTime = selectedBatch ? selectedBatch.from : '09:00';
  const workEndTime = selectedBatch ? selectedBatch.to : '19:00';

  const workStart = timeToMinutes(workStartTime);
  const workEnd = timeToMinutes(workEndTime);
  const lunchStart = timeToMinutes(lunchFrom);
  const lunchEnd = timeToMinutes(lunchTo);

  // Calculate standard working minutes per day
  let standardWorkingMinutes = workEnd - workStart;
  if (!isLunchConsider) {
    standardWorkingMinutes -= (lunchEnd - lunchStart);
  }
  intervals.forEach(interval => {
    if (!interval.isBreakConsider) {
      const intervalStart = timeToMinutes(interval.from);
      const intervalEnd = timeToMinutes(interval.to);
      standardWorkingMinutes -= (intervalEnd - intervalStart);
    }
  });

  const filteredData = attendanceData.filter(record => {
    const recordDate = new Date(record.date);
    const from = new Date(fromDate);
    const to = new Date(toDate);
    recordDate.setHours(0, 0, 0, 0);
    from.setHours(0, 0, 0, 0);
    to.setHours(0, 0, 0, 0);
    return recordDate >= from && recordDate <= to;
  });

  if (filteredData.length === 0 && isSingleDay) {
    return { ...emptyResponse() };
  }

  const worker = filteredData.length > 0 ? (filteredData[0].worker || {}) : {};
  const originalSalary = worker.salary || 0;

  const allDates = generateDateRange(fromDate, toDate);
  const totalDaysInPeriod = allDates.length;
  const totalSundaysInPeriod = countSundaysInRange(fromDate, toDate);

  // Count total holidays in the period
  const totalHolidaysInPeriod = allDates.filter(date => isHoliday(date)).length;

  // Calculate working days excluding Sundays and holidays
  const totalWorkingDaysInPeriod = totalDaysInPeriod - totalSundaysInPeriod - totalHolidaysInPeriod;

  const perDaySalary = totalWorkingDaysInPeriod > 0 ? originalSalary / totalWorkingDaysInPeriod : 0;
  const perMinuteSalary = standardWorkingMinutes > 0 ? perDaySalary / standardWorkingMinutes : 0;
  const totalExpectedMinutes = totalWorkingDaysInPeriod * standardWorkingMinutes;

  let totalWorkingMinutes = 0;
  let totalPermissionMinutes = 0;
  let dailyBreakdown = [];
  let punctualityViolations = 0;
  let report = [];
  let totalAbsentDays = 0;
  let totalSundayCount = 0;
  let totalHolidayCount = 0;

  const groupedByDate = {};
  filteredData.forEach(record => {
    const dateKey = new Date(record.date).toDateString();
    if (!groupedByDate[dateKey]) groupedByDate[dateKey] = [];
    groupedByDate[dateKey].push(record);
  });

  const processDay = (punches, date) => {
    const dayData = {
      date,
      punchTime: punches.length === 1 ? punches[0].originalTime : `${punches[0].originalTime} - ${punches[punches.length - 1].originalTime}`,
      workingMinutes: 0,
      permissionMinutes: 0,
      salaryDeduction: 0,
      issues: [],
      detailedBreakdown: {
        intervals: [],
        deductions: [],
        permissionDetails: []
      }
    };

    const firstPunch = punches[0];
    const lastPunch = punches[punches.length - 1];

    // Calculate detailed working time and permission time
    const workingTimeResult = calculateWorkingTimeDetailed(punches, workStart, workEnd);
    const permissionTimeResult = calculatePermissionTimeDetailed(punches, workStart, workEnd);

    const adjustedWorkingTime = Math.max(0, workingTimeResult.totalWorkingMinutes - permissionTimeResult.totalPermissionMinutes);

    // Store detailed breakdown
    dayData.detailedBreakdown = {
      intervals: workingTimeResult.intervals,
      deductions: workingTimeResult.deductions,
      permissionDetails: permissionTimeResult.details
    };

    // Generate issues/remarks with detailed information
    permissionTimeResult.details.forEach(detail => {
      if (detail.totalMinutes <= permissionTimeMinutes) {
        dayData.issues.push(`${detail.type}: ${Math.round(detail.totalMinutes)} minutes (within permission)`);
      } else {
        punctualityViolations++;
        dayData.issues.push(`${detail.type}: ${Math.round(detail.totalMinutes)} minutes (${permissionTimeMinutes} permission + ${Math.round(detail.excessMinutes)} excess)`);
      }
    });

    dayData.workingMinutes = adjustedWorkingTime;
    dayData.permissionMinutes = permissionTimeResult.totalPermissionMinutes;
    dayData.salaryDeduction = permissionTimeResult.totalPermissionMinutes * perMinuteSalary;

    // Generate detailed report entries for each delay (gap between OUT and IN)
    const dateFormatted = formatDate(date);

    // Check for late arrival (first punch after work start)
    if (firstPunch.time > workStart) {
      const lateMinutes = firstPunch.time - workStart;
      const lateDeduction = Math.min(lateMinutes, permissionTimeMinutes) * perMinuteSalary +
        Math.max(0, lateMinutes - permissionTimeMinutes) * perMinuteSalary;

      report.push({
        date: dateFormatted,
        outTime: formatTime(workStart), // Expected start time
        inTime: formatTime(firstPunch.time), // Actual in time
        delayTime: `${Math.round(lateMinutes)} mins`,
        delayType: 'Late Arrival',
        deductionAmount: formatCurrency(lateDeduction),
        status: 'Delay'
      });
    }

    // Process gaps between OUT and IN punches (breaks/delays)
    for (let i = 0; i < punches.length - 1; i++) {
      let currentStatus = punches[i].record.status ||
        punches[i].record.presence ||
        punches[i].record.type ||
        punches[i].record.Presence ||
        punches[i].record.STATUS;

      let nextStatus = punches[i + 1].record.status ||
        punches[i + 1].record.presence ||
        punches[i + 1].record.type ||
        punches[i + 1].record.Presence ||
        punches[i + 1].record.STATUS;

      // If no status found, assume alternating pattern starting with IN
      if (!currentStatus || !nextStatus) {
        currentStatus = i % 2 === 0 ? 'IN' : 'OUT';
        nextStatus = (i + 1) % 2 === 0 ? 'IN' : 'OUT';
      }

      // Look for OUT -> IN patterns (gaps/delays)
      if (currentStatus === 'OUT' && nextStatus === 'IN') {
        const outTime = punches[i].time;
        const inTime = punches[i + 1].time;
        const gapMinutes = inTime - outTime;

        // Check if this gap overlaps with lunch time
        const lunchStart = timeToMinutes(lunchFrom);
        const lunchEnd = timeToMinutes(lunchTo);
        const isLunchPeriod = (outTime < lunchEnd && inTime > lunchStart);

        // Check if this gap overlaps with any defined break intervals
        let isDefinedBreak = false;
        intervals.forEach(interval => {
          const breakStart = timeToMinutes(interval.from);
          const breakEnd = timeToMinutes(interval.to);
          if (outTime < breakEnd && inTime > breakStart) {
            isDefinedBreak = true;
          }
        });

        // Calculate expected gap time
        let expectedGapTime = 0;
        if (isLunchPeriod && !isLunchConsider) {
          expectedGapTime = Math.max(0, Math.min(inTime, lunchEnd) - Math.max(outTime, lunchStart));
        }

        intervals.forEach(interval => {
          if (!interval.isBreakConsider) {
            const breakStart = timeToMinutes(interval.from);
            const breakEnd = timeToMinutes(interval.to);
            if (outTime < breakEnd && inTime > breakStart) {
              expectedGapTime += Math.min(inTime, breakEnd) - Math.max(outTime, breakStart);
            }
          }
        });

        // Calculate delay time (gap beyond expected break time)
        const delayMinutes = Math.max(0, gapMinutes - expectedGapTime);

        if (delayMinutes > 0) {
          const delayDeduction = Math.min(delayMinutes, permissionTimeMinutes) * perMinuteSalary +
            Math.max(0, delayMinutes - permissionTimeMinutes) * perMinuteSalary;

          let delayType = 'Break Delay';
          if (isLunchPeriod) delayType = 'Lunch Delay';
          if (isDefinedBreak) delayType = 'Break Delay';

          report.push({
            date: dateFormatted,
            outTime: formatTime(outTime),
            inTime: formatTime(inTime),
            delayTime: `${Math.round(delayMinutes)} mins`,
            delayType: delayType,
            deductionAmount: formatCurrency(delayDeduction),
            status: 'Delay'
          });
        }
      }
    }

    // Check for early departure (last punch before work end)
    if (punches.length > 1 && lastPunch.time < workEnd) {
      const earlyMinutes = workEnd - lastPunch.time;
      const earlyDeduction = Math.min(earlyMinutes, permissionTimeMinutes) * perMinuteSalary +
        Math.max(0, earlyMinutes - permissionTimeMinutes) * perMinuteSalary;

      report.push({
        date: dateFormatted,
        outTime: formatTime(lastPunch.time), // Actual out time
        inTime: formatTime(workEnd), // Expected end time
        delayTime: `${Math.round(earlyMinutes)} mins`,
        delayType: 'Early Departure',
        deductionAmount: formatCurrency(earlyDeduction),
        status: 'Delay'
      });
    }

    // Add a summary row for the day if there were no delays
    const dayHasDelays = report.some(r => r.date === dateFormatted && r.status === 'Delay');
    if (!dayHasDelays) {
      report.push({
        date: dateFormatted,
        outTime: formatTime(firstPunch.time),
        inTime: punches.length > 1 ? formatTime(lastPunch.time) : '-',
        delayTime: '0 mins',
        delayType: 'No Delays',
        deductionAmount: formatCurrency(0),
        status: 'Present'
      });
    }

    totalWorkingMinutes += dayData.workingMinutes;
    totalPermissionMinutes += permissionTimeResult.totalPermissionMinutes;
    dailyBreakdown.push(dayData);
  };

  const processMissedDay = (date) => {
    const dateString = date.toISOString().split('T')[0];
    const isSundayDay = isSunday(date);
    const holidayInfo = isHoliday(date);

    if (isSundayDay) {
      totalSundayCount++;
      const dayData = {
        date: dateString,
        punchTime: '-',
        workingMinutes: 0,
        permissionMinutes: 0,
        salaryDeduction: 0,
        issues: ['Sunday - Weekly off'],
        detailedBreakdown: { intervals: [], deductions: [], permissionDetails: [] }
      };

      const reportEntry = {
        date: formatDate(dateString),
        outTime: '-',
        inTime: '-',
        delayTime: '-',
        delayType: 'Sunday - Weekly off',
        deductionAmount: '-',
        status: 'Sunday'
      };

      report.push(reportEntry);
      dailyBreakdown.push(dayData);
    } else if (holidayInfo) {
      totalHolidayCount++;
      const dayData = {
        date: dateString,
        punchTime: '-',
        workingMinutes: 0,
        permissionMinutes: 0,
        salaryDeduction: 0,
        issues: [`Holiday - ${holidayInfo.name || 'Public Holiday'}`],
        detailedBreakdown: { intervals: [], deductions: [], permissionDetails: [] }
      };

      const reportEntry = {
        date: formatDate(dateString),
        outTime: '-',
        inTime: '-',
        delayTime: '-',
        delayType: `Holiday - ${holidayInfo.name || 'Public Holiday'}`,
        deductionAmount: '-',
        status: 'Holiday'
      };

      report.push(reportEntry);
      dailyBreakdown.push(dayData);
    } else {
      totalAbsentDays++;
      const dayData = {
        date: dateString,
        punchTime: 'Absent',
        workingMinutes: 0,
        permissionMinutes: 0,
        salaryDeduction: perDaySalary,
        issues: ['Absent - Full day salary deducted'],
        detailedBreakdown: { intervals: [], deductions: [], permissionDetails: [] }
      };

      const reportEntry = {
        date: formatDate(dateString),
        outTime: 'Absent',
        inTime: 'Absent',
        delayTime: 'Full Day',
        delayType: 'Absent - Full day',
        deductionAmount: formatCurrency(perDaySalary),
        status: 'Absent'
      };

      report.push(reportEntry);
      dailyBreakdown.push(dayData);
    }
  };

  allDates.forEach(date => {
    const dateKey = date.toDateString();
    const dateString = date.toISOString().split('T')[0];

    if (groupedByDate[dateKey]) {
      const punches = groupedByDate[dateKey].map(record => ({
        time: parseAttendanceTime(record.time),
        originalTime: record.time,
        record
      })).sort((a, b) => a.time - b.time);

      if (punches.length > 0) {
        processDay(punches, dateString);
      }
    } else {
      processMissedDay(date);
    }
  });

  const totalDays = dailyBreakdown.length;
  const actualWorkingDays = totalWorkingDaysInPeriod - totalAbsentDays;
  const productivityPercentage = totalExpectedMinutes > 0 ? (totalWorkingMinutes / totalExpectedMinutes) * 100 : 0;
  const averageWorkingHours = actualWorkingDays > 0 ? (totalWorkingMinutes / actualWorkingDays) / 60 : 0;
  const punctualityScore = actualWorkingDays > 0 ? ((actualWorkingDays - punctualityViolations) / actualWorkingDays) * 100 : 0;
  const attendanceRate = totalWorkingDaysInPeriod > 0 ? (actualWorkingDays / totalWorkingDaysInPeriod) * 100 : 0;

  const salaryFromWorkingMinutes = totalWorkingMinutes * perMinuteSalary;
  const totalAbsentDeduction = totalAbsentDays * perDaySalary;
  const totalPermissionDeduction = totalPermissionMinutes * perMinuteSalary;
  const totalSalaryDeduction = totalAbsentDeduction + totalPermissionDeduction;

  const finalSalary = Math.max(0, originalSalary - totalSalaryDeduction);

  const finalSummary = {
    "Total Days in Period": totalDaysInPeriod,
    "Total Working Days": totalWorkingDaysInPeriod,
    "Total Sundays": totalSundaysInPeriod,
    "Total Holidays": totalHolidayCount,
    "Total Absent Days": totalAbsentDays,
    "Actual Working Days": actualWorkingDays,
    "Total Working Hours": `${(totalWorkingMinutes / 60).toFixed(2)} hours`,
    "Total Permission Time": `${Math.round(totalPermissionMinutes)} minutes`,
    "Absent Deduction": formatCurrency(totalAbsentDeduction),
    "Permission Deduction": formatCurrency(totalPermissionDeduction),
    "Total Salary Deductions": formatCurrency(totalSalaryDeduction),
    "Attendance Rate": `${attendanceRate.toFixed(1)}%`,
    "Final Salary": formatCurrency(finalSalary)
  };

  console.log(finalSummary);

  return {
    totalDays,
    workingDays: actualWorkingDays,
    totalWorkingHours: totalWorkingMinutes / 60,
    averageWorkingHours,
    totalPermissionTime: totalPermissionMinutes,
    totalSalaryDeduction,
    totalAbsentDays,
    totalSundayCount: totalSundaysInPeriod,
    totalHolidayCount,
    productivityPercentage,
    dailyBreakdown: dailyBreakdown.map(day => ({
      ...day,
      workingHours: day.workingMinutes / 60,
      permissionTime: day.permissionMinutes,
      workingTimeDisplay: day.workingMinutes > 0 ? minutesToTime(day.workingMinutes) : '-',
      permissionTimeDisplay: day.permissionMinutes > 0 ? minutesToTime(day.permissionMinutes) : '-',
      daySalaryFromMinutes: day.workingMinutes * perMinuteSalary,
      expectedDaySalary: perDaySalary
    })),
    summary: {
      punctualityScore,
      attendanceRate,
      finalSalary,
      originalSalary,
      originalSalaryForPeriod: originalSalary,
      salaryFromWorkingMinutes,
      perMinuteSalary,
      perDaySalary,
      totalWorkingDaysInPeriod,
      totalDaysInPeriod,
      totalSundaysInPeriod,
      totalHolidaysInPeriod,
      totalAbsentDays,
      actualWorkingDays,
      absentDeduction: totalAbsentDeduction,
      permissionDeduction: totalPermissionDeduction,
      worker: {
        name: worker.name || '',
        username: worker.username || '',
        rfid: worker.rfid || '',
        department: worker.department || '',
        email: worker.email || '',
        salary: worker.salary || 0
      }
    },
    configuration: {
      considerOvertime,
      deductSalary,
      workStartTime,
      workEndTime,
      lunchStartTime: lunchFrom,
      lunchEndTime: lunchTo,
      permissionTimeMinutes,
      salaryDeductionPerBreak,
      standardWorkingMinutesPerDay: standardWorkingMinutes
    },
    finalSummary,
    report: report.sort((a, b) => new Date(a.date) - new Date(b.date))
  };
};

function emptyResponse() {
  return {
    totalDays: 0,
    workingDays: 0,
    totalWorkingHours: 0,
    averageWorkingHours: 0,
    totalPermissionTime: 0,
    totalSalaryDeduction: 0,
    totalAbsentDays: 0,
    totalSundayCount: 0,
    totalHolidayCount: 0,
    productivityPercentage: 0,
    dailyBreakdown: [],
    summary: {
      punctualityScore: 0,
      attendanceRate: 0,
      finalSalary: 0,
      originalSalary: 0,
      perMinuteSalary: 0,
      totalWorkingDaysInPeriod: 0,
      totalDaysInPeriod: 0,
      totalSundaysInPeriod: 0,
      totalHolidaysInPeriod: 0,
      totalAbsentDays: 0,
      actualWorkingDays: 0,
      absentDeduction: 0,
      permissionDeduction: 0,
      worker: {
        name: '',
        username: '',
        rfid: '',
        department: '',
        email: '',
        perDaySalary: 0
      }
    },
    configuration: {},
    finalSummary: {
      "Total Days in Period": 0,
      "Total Working Days": 0,
      "Total Sundays": 0,
      "Total Holidays": 0,
      "Total Absent Days": 0,
      "Actual Working Days": 0,
      "Total Working Hours": "0 hours",
      "Total Permission Time": "0 minutes",
      "Absent Deduction": "₹0.00",
      "Permission Deduction": "₹0.00",
      "Total Salary Deductions": "₹0.00",
      "Attendance Rate": "0%",
      "Final Salary": "₹0.00"
    },
    report: []
  };
}