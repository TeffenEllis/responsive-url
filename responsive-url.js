(function () {
  'use strict'

  function isWordedPart (str) {
    // TODO - better regexes
    var wordRe = /^(([a-z]*?[aeiouy][a-z]*?)|(\d*)|q)$/i
    var acronymRe = /^([a-z]{2,5}|[A-Z]{2,5})$/
    var split = str.split(/-|\.|,|\+|_|%20/)

    for (var i = 0; i < split.length; i++) {
      if (!wordRe.test(split[i]) && !acronymRe.test(split[i])) {
        return false
      }
    }

    return true
  }

  function collapseAdjacentEllipsizedParams (str) {
    var originalStr = str

    str = str
      .replace(/&\.\.\.&\.\.\.&/g, '&...&')
      .replace(/\.\.\.&\.\.\.&/g, '...&')
      .replace(/&\.\.\.&\.\.\./g, '&...')

    if (str.length === originalStr.length) return str

    return collapseAdjacentEllipsizedParams(str)
  }

  // TODO - combine with collapseAdjacentEllipsizedParams
  function collapseAdjacentEllipsizedPaths (str) {
    var originalStr = str

    str = str
      .replace(/\/\.\.\.\/\.\.\.\//g, '/.../')
      .replace(/\.\.\.\/\.\.\.\//g, '.../')
      .replace(/\/\.\.\.\/\.\.\./g, '/...')

    if (str.length === originalStr.length) return str

    return collapseAdjacentEllipsizedPaths(str)
  }

  var shorteners = [
    function removeProtocol (url) {
      return url.replace(/^https?:\/?\/?/i, '')
    },
    function removeWWW (url) {
      return url.replace(/^www\./, '')
    },
    function removePort (url) {
      var urlSlashSplit = url.split('/')
      var domain = urlSlashSplit[0]
      urlSlashSplit[0] = domain.split(':')[0]

      return urlSlashSplit.join('/')
    },
    function removeHumanUnfriendlyQuery (url, maxLength) {
      var indexOfQuestionMark = url.indexOf('?')
      if (indexOfQuestionMark < 0) return url

      var beforeQuery = url.substr(0, indexOfQuestionMark)
      var query = url.substr(indexOfQuestionMark + 1)

      var indexOfHash = query.indexOf('#')
      var hash = ''
      var queryBeforeHash = query

      if (indexOfHash > -1) {
        queryBeforeHash = query.substr(0, indexOfHash)
        hash = query.substr(indexOfHash)
      }

      var queryParts = queryBeforeHash.split('&')
      queryParts.forEach(function (queryPart, i) {
        var paramPair = queryParts[i].split('=')

        // TODO - write simpler
        if (!isWordedPart(paramPair[0]) && (paramPair.length > 1 && !isWordedPart(paramPair[1]))) {
          queryParts[i] = '...'
        } else if (!isWordedPart(paramPair[0]) && (paramPair.length > 1 && isWordedPart(paramPair[1]))) {
          queryParts[i] = '...=' + paramPair[1]
        } else if (isWordedPart(paramPair[0]) && (paramPair.length > 1 && !isWordedPart(paramPair[1]))) {
          queryParts[i] = paramPair[0] + '=...'
        }
      })

      query = queryParts.join('&')
      return beforeQuery + '?' + collapseAdjacentEllipsizedParams(query) + hash
    },
    // TODO - treat file.ext differently than /paths/ between two /
    function removeHumanUnfriendlyPaths (url, maxLength) {
      var indexOfSlash = url.indexOf('/')
      if (indexOfSlash < 0) return url

      var beforeSlash = url.substr(0, indexOfSlash)
      var afterSlash = url.substr(indexOfSlash + 1)

      var indexOfQuery = afterSlash.indexOf('?')
      var indexOfHash = afterSlash.indexOf('#')

      var afterSlashSuffix = ''
      var afterSlashBeforeSuffix = afterSlash

      if (indexOfQuery > -1 || indexOfHash > -1) {
        var indexOfSuffix = indexOfQuery !== -1 ? indexOfQuery : indexOfHash

        if (indexOfQuery > -1 && indexOfHash > -1) {
          indexOfSuffix = indexOfQuery < indexOfHash ? indexOfQuery : indexOfHash
        }

        afterSlashBeforeSuffix = afterSlash.substr(0, indexOfSuffix)
        afterSlashSuffix = afterSlash.substr(indexOfSuffix)
      }

      var pathParts = afterSlashBeforeSuffix.split('/')
      pathParts.forEach(function (pathPart, i) {
        if (!isWordedPart(pathPart)) {
          pathParts[i] = '...'
        }
      })

      afterSlash = pathParts.join('/')
      return beforeSlash + '/' + collapseAdjacentEllipsizedPaths(afterSlash) + afterSlashSuffix
    },
    function ellipsizeDomainParts (url, maxLength) {
      var urlSlashSplit = url.split('/')
      var domain = urlSlashSplit[0]
      var domainParts = domain.split('.')
      var longestDomainPart = ''
      var longestDomainPartIndex = -1
      var domainEllipsis = '[...]'

      domainParts.forEach(function (domainPart, i) {
        if (domainPart.length > longestDomainPart.length) {
          longestDomainPart = domainPart
          longestDomainPartIndex = i
        }
      })

      var domainMaxLength = maxLength - (url.length - longestDomainPart.length)
      if (url.length - longestDomainPart.length > domainMaxLength) {
        domainMaxLength = Math.max(domainMaxLength, url.length - longestDomainPart.length)
      }

      var newLongestDomainPart = longestDomainPart.substr(0, domainMaxLength - domainEllipsis.length)
      if (newLongestDomainPart === longestDomainPart) return url

      domainParts[longestDomainPartIndex] = newLongestDomainPart + domainEllipsis
      urlSlashSplit[0] = domainParts.join('.')

      return urlSlashSplit.join('/')
    },
    function prioritizeDomainOverSubDomainsAndTLD (url, maxLength) {
      var urlSlashSplit = url.split('/')
      var domain = urlSlashSplit[0]
      var domainParts = domain.split('.')
      var ellipsis = '...'

      // Only treat subdomains
      if (domainParts.length < 3) return url

      // Don’t run if domain has already been shortened
      if (urlSlashSplit[0].indexOf('[...]') > -1) return url

      var subDomainsPriorToMainDomain = domainParts.slice(0, domainParts.length - 2)
      var subDomainsPriorToMainDomainStr = subDomainsPriorToMainDomain.join('.')

      var domainAndTLD = domainParts.slice(domainParts.length - 2).join('.')

      // var subDomainMaxLength = maxLength - (url.length - subDomainsPriorToMainDomainStr.length) - 1; // TODO
      var subDomainMaxLength = maxLength - (url.length - subDomainsPriorToMainDomainStr.length) - 1 // TODO

      var newSubDomainsPriorToMainDomainStr = subDomainsPriorToMainDomainStr.substr(subDomainsPriorToMainDomainStr.length - (subDomainMaxLength - ellipsis.length))
      if (newSubDomainsPriorToMainDomainStr === subDomainsPriorToMainDomainStr) {
        return url
      }

      urlSlashSplit[0] = '...' + newSubDomainsPriorToMainDomainStr + '.' + domainAndTLD
      return urlSlashSplit.join('/')
    },
    function mergeEllipsies (url) {
      return url.replace(/(\.){3,}/g, '...')
    },
    function ellipsize (url, maxLength) {
      return url
        .substr(0, maxLength - 3) + '...'
        .replace(/(\.){3,}/g, '...')
        .replace(/\[\.\.\.\]\.\.\.$/g, '...') // TODO - be smarter
        .replace(/\[\.\.\.$/g, '...') // TODO - be smarter
        .replace(/(\.){3,}/g, '...') // TODO - necessary?
    }
  ]

  function truncateURL (url, maxLength) {
    shorteners.forEach(function (shortener) {
      if (url.length <= maxLength) return

      url = shortener(url, maxLength)
    })

    return url
  }

  var ResponsiveURL = {
    truncateURL: truncateURL
  }

  if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    module.exports = ResponsiveURL
  } else {
    window.ResponsiveURL = ResponsiveURL
  }
}())
