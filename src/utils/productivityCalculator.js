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
    isLunchConsider = false
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

  // Calculate working time by summing only IN→OUT intervals with precise time handling
  const calculateWorkingTime = (punches, workStart, workEnd) => {
    if (punches.length === 0) return 0;

    let totalWorkingMinutes = 0;

    // Debug log to see the structure
    if (punches.length > 0) {
      console.log('Sample punch record:', punches[0].record);
      console.log('Punches with times:', punches.map(p => ({
        time: p.originalTime,
        minutes: p.time,
        status: p.record.status || p.record.presence || p.record.type || 'Unknown'
      })));
    }

    // Sum all IN→OUT intervals
    for (let i = 0; i < punches.length - 1; i++) {
      // Check for status in different possible properties
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

      console.log(`Checking interval ${i}: ${currentStatus} (${punches[i].originalTime}) → ${nextStatus} (${punches[i + 1].originalTime})`);

      if (currentStatus === 'IN' && nextStatus === 'OUT') {
        // Get the actual working period within work hours
        let intervalStart = Math.max(punches[i].time, workStart);
        let intervalEnd = Math.min(punches[i + 1].time, workEnd);

        console.log(`Raw interval: ${intervalStart.toFixed(2)} → ${intervalEnd.toFixed(2)} minutes`);

        // Only add if it's a valid working interval
        if (intervalEnd > intervalStart) {
          let workingInterval = intervalEnd - intervalStart;
          console.log(`Working interval before deductions: ${workingInterval.toFixed(2)} minutes (${(workingInterval / 60).toFixed(2)} hours)`);

          // Deduct lunch time from this interval if not considered as working time
          if (!isLunchConsider) {
            const lunchStart = timeToMinutes(lunchFrom);
            const lunchEnd = timeToMinutes(lunchTo);

            console.log(`Lunch period: ${lunchStart} → ${lunchEnd} minutes`);

            // Check if this interval overlaps with lunch time
            if (intervalStart < lunchEnd && intervalEnd > lunchStart) {
              const lunchOverlap = Math.min(intervalEnd, lunchEnd) - Math.max(intervalStart, lunchStart);
              console.log(`Lunch overlap: ${lunchOverlap.toFixed(2)} minutes`);
              workingInterval -= Math.max(0, lunchOverlap);
            }
          }

          // Deduct break intervals if not considered as working time
          intervals.forEach((interval, idx) => {
            if (!interval.isBreakConsider) {
              const breakStart = timeToMinutes(interval.from);
              const breakEnd = timeToMinutes(interval.to);

              // Check if this working interval overlaps with break time
              if (intervalStart < breakEnd && intervalEnd > breakStart) {
                const breakOverlap = Math.min(intervalEnd, breakEnd) - Math.max(intervalStart, breakStart);
                console.log(`Break ${idx} overlap: ${breakOverlap.toFixed(2)} minutes`);
                workingInterval -= Math.max(0, breakOverlap);
              }
            }
          });

          console.log(`Final working interval: ${workingInterval.toFixed(2)} minutes (${(workingInterval / 60).toFixed(2)} hours)`);
          totalWorkingMinutes += Math.max(0, workingInterval);
        }
      }
    }

    console.log(`Total working minutes before overtime check: ${totalWorkingMinutes.toFixed(2)}`);

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

      console.log(`Expected work time: ${expectedWorkTime.toFixed(2)} minutes`);
      totalWorkingMinutes = Math.min(totalWorkingMinutes, expectedWorkTime);
    }

    console.log(`Final total working minutes: ${totalWorkingMinutes.toFixed(2)} (${(totalWorkingMinutes / 60).toFixed(2)} hours)`);
    return Math.max(0, totalWorkingMinutes);
  };

  // Calculate permission/penalty time
  const calculatePermissionTime = (punches, workStart, workEnd) => {
    if (punches.length === 0) return 0;

    const firstPunch = punches[0];
    const lastPunch = punches[punches.length - 1];
    let permissionTime = 0;

    // Late arrival
    if (firstPunch.time > workStart) {
      permissionTime += (firstPunch.time - workStart);
    }

    // Early departure (only if there's an OUT punch)
    if (punches.length > 1 && lastPunch.time < workEnd) {
      permissionTime += (workEnd - lastPunch.time);
    }

    return permissionTime;
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
  const totalWorkingDaysInPeriod = totalDaysInPeriod - totalSundaysInPeriod;

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
      issues: []
    };

    const firstPunch = punches[0];
    const lastPunch = punches[punches.length - 1];

    // Calculate actual working time
    const workingTime = calculateWorkingTime(punches, workStart, workEnd);
    const permissionTime = calculatePermissionTime(punches, workStart, workEnd);

    const adjustedWorkingTime = Math.max(0, workingTime - permissionTime);

    // Generate issues/remarks
    if (firstPunch.time > workStart) {
      const lateMinutes = firstPunch.time - workStart;
      if (lateMinutes <= permissionTimeMinutes) {
        dayData.issues.push(`Late arrival: ${Math.round(lateMinutes)} minutes (within permission)`);
      } else {
        punctualityViolations++;
        dayData.issues.push(`Late arrival: ${Math.round(lateMinutes)} minutes (${permissionTimeMinutes} permission + ${Math.round(lateMinutes - permissionTimeMinutes)} excess)`);
      }
    }

    if (lastPunch.time < workEnd && punches.length > 1) {
      const earlyMinutes = workEnd - lastPunch.time;
      if (earlyMinutes > permissionTimeMinutes) {
        const excessEarlyMinutes = earlyMinutes - permissionTimeMinutes;
        dayData.issues.push(`Early departure: ${Math.round(earlyMinutes)} minutes (${permissionTimeMinutes} permission + ${Math.round(excessEarlyMinutes)} excess)`);
      } else {
        dayData.issues.push(`Early departure: ${Math.round(earlyMinutes)} minutes (within permission)`);
      }
    }

    dayData.workingMinutes = adjustedWorkingTime;
    dayData.permissionMinutes = permissionTime;
    dayData.salaryDeduction = permissionTime * perMinuteSalary;

    const reportEntry = {
      date: formatDate(date),
      inTime: formatTime(firstPunch.time),
      outTime: punches.length > 1 ? formatTime(lastPunch.time) : '-',
      workedHours: (adjustedWorkingTime / 60).toFixed(2) + ' hrs',   // ✅ use adjusted time
      permissionMins: Math.round(permissionTime),
      deduction: formatCurrency(dayData.salaryDeduction),
      status: 'Present'
    };

    report.push(reportEntry);
    totalWorkingMinutes += dayData.workingMinutes;
    totalPermissionMinutes += permissionTime;
    dailyBreakdown.push(dayData);
  };

  const processMissedDay = (date) => {
    const dateString = date.toISOString().split('T')[0];
    const isSundayDay = isSunday(date);

    if (isSundayDay) {
      totalSundayCount++;
      const dayData = {
        date: dateString,
        punchTime: '-',
        workingMinutes: 0,
        permissionMinutes: 0,
        salaryDeduction: 0,
        issues: ['Sunday - Weekly off']
      };

      const reportEntry = {
        date: formatDate(dateString),
        inTime: '-',
        outTime: '-',
        workedHours: '-',
        permissionMins: '-',
        deduction: '-',
        status: 'Sunday'
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
        issues: ['Absent - Full day salary deducted']
      };

      const reportEntry = {
        date: formatDate(dateString),
        inTime: 'Absent',
        outTime: 'Absent',
        workedHours: '0 hrs',
        permissionMins: 0,
        deduction: formatCurrency(perDaySalary),
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
      "Total Absent Days": 0,
      "Actual Working Days": 0,
      "Total Working Hours": "0 hours",
      "Total Permission Time": "0 minutes",
      "Absent Deduction": "₹0.00",
      "Attendance Rate": "0%",
      "Permission Deduction": "₹0.00",
      "Total Salary Deductions": "₹0.00",
      "Final Salary": "₹0.00"
    },
    report: []
  };
}