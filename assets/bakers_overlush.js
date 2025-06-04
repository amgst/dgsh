$(document).ready(function() {
  loadTSV();
})

function loadTSV() {

  var lists = null;

  var t_limit = 0;
  var limit = 0;
  var len = 0;
  var direc = 1;

  var s_cat = null;
  // var s_cat = 'id';

  var o_name_handle_arr = [];
  var o_name_arr = [];
  var o_id_arr = [];
  var o_idx_arr = [];

  var r_name_arr = [];

  var name_arr = [];
  var id_arr = [];
  var idx_arr = [];

  $.ajax({
    type: "GET",  
    url: "https://cdn.shopify.com/s/files/1/0554/6190/4593/files/backers_overlush.tsv?v=1708532277",
    dataType: "text",       
    success: function(response){

      lists = response.split('\n');
    
      limit = parseInt($('[data-rows-num]').val());
      if($(window).width() < 750) {
        if(limit == 25) {
          limit = 26;
        }
      }
      t_limit = limit;

      len = 0;

      if(lists.length > 1) {
        for(var i = 1; i < lists.length; i ++) {
          var list = lists[i].split('\t');
          if(list[1].indexOf('"') > -1) {
            // console.log(list[1]);
            // continue;
          }

          var list_id = list[0];
          var list_name = list[1].replace(/(\r\n|\r|\n)/g, '').replaceAll('"', '');

          if(list_name.includes(list_name)) {
            r_name_arr[list_name+i] = list_name;
            // list_name = list_name + '' + i;
            // list_name = list_name;
          }

          o_id_arr.push(list_id.replace('"', ''));
          o_name_arr.push(list_name);
          o_name_handle_arr.push(list_name);
          // var r_num = Math.ceil(Math.random() * 120);          
          // var r_num = Math.floor(Math.random() * (539 - 400 + 1)) + 400;
          var r_num = Math.floor(Math.random() * (939 - 800 + 1)) + 800;
          if(r_num == 0) {
            r_num = 1
          }
          o_idx_arr.push(r_num);
          len ++;
        }
  
        o_name_handle_arr.sort();

        buildGrid();
      }

    }
  });


  var timer;

  $('[data-backer-search-overlush]').on('keydown', function(e) {
    clearTimeout(timer);
    timer = setTimeout(function() {
      buildGrid();
    }, 1000);
  })

  $('[data-rows-num]').on('change', function() {
    limit = parseInt($(this).val());
    t_limit = limit;
    buildGrid();
  })

  $(document).on('click', '[data-sort-btn]', function() {
    if(! $(this).hasClass('active')) {
      $('[data-sort-btn]').removeClass('active');
      $(this).addClass('active');
      if($(this).hasClass('sort_dec')) {
        direc = -1;
      }
      else {
        direc = 1;
      }
      backerSort();
    }
  })

  $(document).on('click', '[data-load-more]', function() {

    var _len = parseInt($('[data-rows-num]').val());
    if($(window).width() < 750) {
      if(_len == 25) {
        _len = 26;
      }
    }
    limit += _len;
    buildGrid();
  })

  $(document).on('click', '.search .key', function() {
    if(! $(this).hasClass('active')) {
      $(this).closest('.sort').find('.key').removeClass('active');
      $(this).addClass('active');

      s_cat = $(this).attr('data-key');

      // backerSort();
      buildGrid();
    }
  })

  function buildGrid() {

    var keyword = (($('[data-backer-search-overlush]').val()).toLowerCase()).replace(' ', '');
    var is_btn_show = false;

    name_arr = [];
    id_arr = [];
    idx_arr = [];

    var _count = 0;

    for(var i = 0; i < len; i ++) {

      var _i = i;
      if(s_cat == 'name') {
        _i = o_name_arr.indexOf(o_name_handle_arr[i]);
      }
      var _str = (o_name_arr[_i].toLowerCase()).replace(' ', '') + ' ' + (o_id_arr[_i].toLowerCase()).trim();


      if(_str.indexOf(keyword) > -1) {
        if(limit >= _count + 1) {
          name_arr.push(o_name_arr[_i]);
          id_arr.push(o_id_arr[_i]);
          idx_arr.push(o_idx_arr[_i]);
        }
        _count ++;
      }
      if(_count > limit) {
        is_btn_show = true;
        _count -= 1;
        break;
      }
    }

    var $container = $('[data-backer-container-overlush]');
    $container.html('');

    if(_count == 0) {
      $('[data-backer-container-overlush]').append('<span data-empty-result>No results.</span>');
    }

    for(var i = 0; i < _count; i ++) {

      var itemHtml = '<div class="item">';
        itemHtml += '<div class="item_wrapper">';
          itemHtml += '<div class="image_wrapper">';
            itemHtml += '<img src="https://cdn.shopify.com/s/files/1/0554/6190/4593/files/' + idx_arr[i] + '.png">';
          itemHtml += '</div>';
          itemHtml += '<div class="info_wrapper">';
            itemHtml += "<span class='name' data-name='" + (name_arr[i].replace('"', '').replace(/\s+/g, '')) + "'>" + (r_name_arr[name_arr[i]] ? r_name_arr[name_arr[i]] : name_arr[i]) + "</span>";
            itemHtml += '<span class="id" data-id="' + (id_arr[i].toLowerCase()).trim() +'">Backer #' + id_arr[i] + '</span>';
          itemHtml += '</div>';
        itemHtml += '</div>';
      itemHtml += '</div>';
      $container.append(itemHtml);
    }
    name_arr.sort();

    if(is_btn_show) {
      $('[data-btn-wrapper]').removeAttr('data--hidden');
    }
    else {
      $('[data-btn-wrapper]').attr('data--hidden', 'true');
    }

    backerSort();
  }

  function backerSort() {
    for(var i = 0; i < id_arr.length; i ++) {
      if(s_cat == 'id' || s_cat == null) {
        id_arr.sort(function(a, b) {
          return a - b;
        });
        var $item = $('[data-backer-container-overlush] > .item [data-id="' + (id_arr[i].toLowerCase()).trim() + '"]').closest('.item');
        $item.css('order', i * direc);
      }
      else {
        var $item = $('[data-backer-container-overlush] > .item [data-name="' + (name_arr[i].replace('"', '').replace(/\s+/g, '')) + '"]').closest('.item');
        $item.css('order', i * direc);
      }
    }
  }

  $(document).on('click', '.leaving-reviews-block:not(.disabled)[data-title="our-website"]', function () {
    $('#leaveReview').removeClass('is-hidden');
  });

  $(document).on('click', '#leaveReview .btn', function () {
    if ($('#leaveReview input.form-control').val() != '' && $('#leaveReview input.form-control').val() != null) {
      showReview();
    }
  });

  $('[data-popup-close]').click(function(){
    $(this).closest('#leaveReview').addClass('is-hidden').trigger('setDefaultContent');
    showReview();
  });

  function showReview() {
      $('.section-leaving-reviews').find('[data-step-1]').addClass('display-none');
      $('.section-leaving-reviews').find('[data-step-2]').removeClass('display-none');

      var product_id = $('#review-product-item').val();
      $('.section-leaving-reviews').find('.yotpo-main-widget').addClass('display-none');
      $('.section-leaving-reviews').find('.yotpo-main-widget[data-product-id="'+product_id+'"]').removeClass('display-none');
      
      window.scrollTo(0, 0);
  }
}

